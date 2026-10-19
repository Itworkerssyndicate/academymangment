-- ============================================
-- ITWS Platform - Database Schema
-- Path: supabase/schema.sql
-- ============================================
-- ⚠️ شغّل هذا الملف أولاً في Supabase SQL Editor
-- ⚠️ ثم شغّل rls-policies.sql
-- ⚠️ ثم شغّل seed.sql
-- ============================================

-- ============================================
-- 0. Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. PROFILES (مستخدمو النظام)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'user' 
    CHECK (role IN ('super_admin', 'admin', 'committee_manager', 'user')),
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active) WHERE is_active = true;

-- ============================================
-- 2. ACADEMY CATEGORIES (تصنيفات الأكاديميات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.academy_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_en text,
  description text,
  color text DEFAULT '#CE1126',
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON public.academy_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_sort ON public.academy_categories(sort_order);

-- ============================================
-- 3. ACADEMIES (الأكاديميات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.academies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_name text,
  founded_year int,
  tax_number text,
  commercial_registry text,
  license_number text UNIQUE,
  category_id uuid REFERENCES public.academy_categories(id) ON DELETE SET NULL,
  email text,
  phone text,
  website_url text,
  facebook_url text,
  description text,
  logo_url text,
  
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'expired')),
  approved_at timestamptz,
  expires_at timestamptz,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academies_category ON public.academies(category_id);
CREATE INDEX IF NOT EXISTS idx_academies_status ON public.academies(status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_academies_license ON public.academies(license_number);

-- ============================================
-- 4. ACADEMY BRANCHES (الفروع)
-- ============================================
CREATE TABLE IF NOT EXISTS public.academy_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  governorate text NOT NULL,
  address text NOT NULL,
  phone text,
  branch_manager text,
  is_main boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_academy ON public.academy_branches(academy_id);
CREATE INDEX IF NOT EXISTS idx_branches_governorate ON public.academy_branches(governorate);

-- ============================================
-- 5. ACADEMY COURSES (كورسات الأكاديميات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  duration_hours int,
  price numeric(10, 2),
  instructors_count int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_academy ON public.academy_courses(academy_id);

-- ============================================
-- 6. ACCREDITATION REQUESTS (طلبات الاعتماد)
-- ============================================
CREATE TABLE IF NOT EXISTS public.accreditation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  request_number text UNIQUE NOT NULL,
  
  current_stage text NOT NULL DEFAULT 'submitted' 
    CHECK (current_stage IN (
      'submitted', 'documents_review', 'site_visit',
      'committee_review', 'final_approval',
      'approved', 'rejected'
    )),
  
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  decided_at timestamptz,
  rejection_reason text,
  approval_expires_at timestamptz,
  
  -- المستندات
  commercial_registry_url text,
  tax_card_url text,
  place_photo_url text,
  payment_receipt_url text,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_academy ON public.accreditation_requests(academy_id);
CREATE INDEX IF NOT EXISTS idx_requests_stage ON public.accreditation_requests(current_stage);
CREATE INDEX IF NOT EXISTS idx_requests_number ON public.accreditation_requests(request_number);

-- ============================================
-- 7. REQUEST STAGE HISTORY (سجل المراحل)
-- ============================================
CREATE TABLE IF NOT EXISTS public.request_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.accreditation_requests(id) ON DELETE CASCADE NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  notes text,
  moved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  moved_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_request ON public.request_stage_history(request_id);

-- ============================================
-- 8. CERTIFICATES (الشهادات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code text UNIQUE NOT NULL,
  
  -- بيانات المتدرب
  student_name text NOT NULL,
  student_national_id text NOT NULL,
  
  -- بيانات الدورة
  course_name text NOT NULL,
  course_hours int,
  grade text,
  completion_date timestamptz,
  
  -- الجهة المُصدرة
  issuer_type text NOT NULL DEFAULT 'academy' 
    CHECK (issuer_type IN ('union', 'academy')),
  academy_id uuid REFERENCES public.academies(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL,
  
  -- Snapshots (نسخة من البيانات وقت الإصدار)
  academy_name text,
  academy_license_number text,
  branch_name text,
  
  -- الحالة
  is_active boolean DEFAULT true,
  issued_at timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  -- Constraint: النقابة = بدون academy_id، الأكاديمية = مع academy_id
  CONSTRAINT certificates_issuer_check CHECK (
    (issuer_type = 'union' AND academy_id IS NULL) OR
    (issuer_type = 'academy' AND academy_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_certs_code ON public.certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certs_national ON public.certificates(student_national_id);
CREATE INDEX IF NOT EXISTS idx_certs_academy ON public.certificates(academy_id);
CREATE INDEX IF NOT EXISTS idx_certs_issuer ON public.certificates(issuer_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_certs_active ON public.certificates(is_active) WHERE is_active = true;

-- ============================================
-- 9. SEARCH LOGS (سجل البحث)
-- ============================================
CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_type text NOT NULL 
    CHECK (search_type IN ('certificate', 'academy', 'student', 'request')),
  search_value text NOT NULL,
  searcher_name text DEFAULT 'زائر',
  searcher_phone text,
  searcher_entity text,
  searcher_entity_type text,
  governorate text,
  result_count int DEFAULT 0,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_type ON public.search_logs(search_type);
CREATE INDEX IF NOT EXISTS idx_search_created ON public.search_logs(created_at DESC);

-- ============================================
-- 10. ACTIVITIES (سجل النشاطات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text,
  user_role text,
  action_type text NOT NULL,
  description text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities(action_type);

-- ============================================
-- 11. SESSIONS (الجلسات / المتصلون)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text DEFAULT 'visitor',
  user_agent text,
  ip_address text,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON public.sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON public.sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- 12. SETTINGS (الإعدادات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================
-- 13. THEMES (الثيمات)
-- ============================================
CREATE TABLE IF NOT EXISTS public.themes (
  id text PRIMARY KEY,
  name text NOT NULL,
  colors jsonb NOT NULL,
  is_light boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 14. LOGIN LOGS (محاولات الدخول)
-- ============================================
CREATE TABLE IF NOT EXISTS public.login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_email ON public.login_logs(email);
CREATE INDEX IF NOT EXISTS idx_login_created ON public.login_logs(created_at DESC);

-- ============================================
-- 15. TRIGGERS (updated_at تلقائي)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated 
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated ON public.academy_categories;
CREATE TRIGGER trg_categories_updated 
  BEFORE UPDATE ON public.academy_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_academies_updated ON public.academies;
CREATE TRIGGER trg_academies_updated 
  BEFORE UPDATE ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_requests_updated ON public.accreditation_requests;
CREATE TRIGGER trg_requests_updated 
  BEFORE UPDATE ON public.accreditation_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_certificates_updated ON public.certificates;
CREATE TRIGGER trg_certificates_updated 
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 16. TRIGGER: إنشاء profile تلقائي عند التسجيل
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 17. Helper Functions (تُستخدم في RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'committee_manager')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ============================================
-- 18. Storage Buckets
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy-documents',
  'academy-documents',
  true,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ✅ نهاية Schema
-- ============================================
