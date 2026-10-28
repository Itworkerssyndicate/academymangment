-- ============================================================
-- ITWS Platform — Database Schema V2
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. GOVERNORATES
-- ============================================================
CREATE TABLE IF NOT EXISTS governorates (
  id SERIAL PRIMARY KEY,
  code VARCHAR(4) UNIQUE NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  region VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. BRANCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate_id INTEGER NOT NULL REFERENCES governorates(id) ON DELETE RESTRICT,
  name_ar VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  address TEXT,
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(governorate_id)
);

-- ============================================================
-- 3. ACADEMY CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_categories (
  id SERIAL PRIMARY KEY,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description TEXT,
  icon_name VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(200) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  avatar_url TEXT,
  bio TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'pending_user',
  governorate_id INTEGER REFERENCES governorates(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  academy_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_primary BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_governorate ON profiles(governorate_id);
CREATE INDEX IF NOT EXISTS idx_profiles_academy ON profiles(academy_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- ============================================================
-- 5. ACADEMIES
-- ============================================================
CREATE TABLE IF NOT EXISTS academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  category_id INTEGER REFERENCES academy_categories(id) ON DELETE SET NULL,
  governorate_id INTEGER REFERENCES governorates(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  website_url TEXT,
  address TEXT,
  city VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_deleted BOOLEAN DEFAULT false,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_rating_visible BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academies_status ON academies(status);
CREATE INDEX IF NOT EXISTS idx_academies_branch ON academies(branch_id);
CREATE INDEX IF NOT EXISTS idx_academies_governorate ON academies(governorate_id);

-- Add FK for profiles.academy_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_academy_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_academy_id_fkey
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE SET NULL;

-- ============================================================
-- 6. ACADEMY BRANCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  governorate_id INTEGER REFERENCES governorates(id) ON DELETE SET NULL,
  address TEXT,
  phone VARCHAR(50),
  is_main BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. ACADEMY COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  duration_hours INTEGER,
  price NUMERIC(10,2),
  level VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. ACADEMY DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(200),
  file_size INTEGER,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. ACADEMY RATINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  rated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review TEXT,
  is_visible BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(academy_id, rated_by)
);

-- ============================================================
-- 10. ACCREDITATION REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS accreditation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) UNIQUE NOT NULL,
  academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
  academy_name VARCHAR(200) NOT NULL,
  academy_email VARCHAR(200),
  academy_phone VARCHAR(50),
  current_stage VARCHAR(50) DEFAULT 'submitted',
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  branches_count INTEGER DEFAULT 0,
  courses_count INTEGER DEFAULT 0,
  documents JSONB DEFAULT '{}',
  contact_person VARCHAR(200),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 11. REQUEST STAGE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS request_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES accreditation_requests(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'completed',
  notes TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 12. SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id VARCHAR(200) UNIQUE NOT NULL,
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON sessions(last_heartbeat DESC);

-- ============================================================
-- 13. USER REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_role VARCHAR(50) NOT NULL,
  governorate_id INTEGER REFERENCES governorates(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
  justification TEXT,
  documents JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  auto_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. LOGIN LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(200),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at DESC);

-- ============================================================
-- 15. ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name VARCHAR(200),
  actor_role VARCHAR(50),
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id TEXT,
  description TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);

-- ============================================================
-- 16. UNION COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS union_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url TEXT,
  duration_hours INTEGER,
  level VARCHAR(50),
  price NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 17. CERTIFICATE TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  issuer_type VARCHAR(20) NOT NULL,
  html_template TEXT,
  css_styles TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 18. CERTIFICATES
-- ============================================================
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  code_type VARCHAR(20) DEFAULT 'auto',
  issuer_type VARCHAR(20) NOT NULL,
  issuer_id UUID,
  student_name VARCHAR(200) NOT NULL,
  national_id VARCHAR(20),
  student_email VARCHAR(200),
  student_phone VARCHAR(50),
  course_type VARCHAR(20) DEFAULT 'academy',
  course_id UUID,
  course_name VARCHAR(200) NOT NULL,
  academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES academy_branches(id) ON DELETE SET NULL,
  governorate_id INTEGER REFERENCES governorates(id) ON DELETE SET NULL,
  grade VARCHAR(20),
  score NUMERIC(5,2),
  duration_hours INTEGER,
  issue_date DATE NOT NULL,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  pdf_url TEXT,
  qr_code_url TEXT,
  template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(code);
CREATE INDEX IF NOT EXISTS idx_certificates_national_id ON certificates(national_id);
CREATE INDEX IF NOT EXISTS idx_certificates_academy ON certificates(academy_id);

-- ============================================================
-- 19. CERTIFICATE REVOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS certificate_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  revoked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT now(),
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- 20. SEARCH LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_type VARCHAR(50) NOT NULL,
  search_query VARCHAR(100),
  query_hash VARCHAR(64),
  found BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 21. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link_url TEXT,
  resource_type VARCHAR(50),
  resource_id TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ============================================================
-- 22. EMAIL TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key VARCHAR(100) UNIQUE NOT NULL,
  subject_ar VARCHAR(200) NOT NULL,
  body_ar TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 23. BACKUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(50) NOT NULL,
  file_url TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 24. SYSTEM STATUS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_status (
  id SERIAL PRIMARY KEY,
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,
  maintenance_until TIMESTAMPTZ,
  min_app_version VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO system_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 25. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 26. LABELS
-- ============================================================
CREATE TABLE IF NOT EXISTS labels (
  key VARCHAR(200) PRIMARY KEY,
  ar_value TEXT NOT NULL,
  en_value TEXT,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  default_ar TEXT NOT NULL,
  is_multiline BOOLEAN DEFAULT false,
  max_length INTEGER,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 27. THEMES
-- ============================================================
CREATE TABLE IF NOT EXISTS themes (
  id VARCHAR(50) PRIMARY KEY,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description_ar TEXT,
  colors JSONB NOT NULL DEFAULT '{}',
  is_dark BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  preview_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_default_theme ON themes((is_default)) WHERE is_default = true;

-- ============================================================
-- 28. PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  allowed BOOLEAN DEFAULT false,
  scope VARCHAR(20) DEFAULT 'global',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, resource, action, scope)
);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_academies_updated_at ON academies;
CREATE TRIGGER trg_academies_updated_at BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_academy_ratings_updated_at ON academy_ratings;
CREATE TRIGGER trg_academy_ratings_updated_at BEFORE UPDATE ON academy_ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_accreditation_requests_updated_at ON accreditation_requests;
CREATE TRIGGER trg_accreditation_requests_updated_at BEFORE UPDATE ON accreditation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_union_courses_updated_at ON union_courses;
CREATE TRIGGER trg_union_courses_updated_at BEFORE UPDATE ON union_courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON certificates;
CREATE TRIGGER trg_certificates_updated_at BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_themes_updated_at ON themes;
CREATE TRIGGER trg_themes_updated_at BEFORE UPDATE ON themes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Academy rating trigger
CREATE OR REPLACE FUNCTION update_academy_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE academies SET
    rating_avg = (SELECT COALESCE(AVG(stars), 0) FROM academy_ratings WHERE academy_id = COALESCE(NEW.academy_id, OLD.academy_id) AND is_visible = true),
    rating_count = (SELECT COUNT(*) FROM academy_ratings WHERE academy_id = COALESCE(NEW.academy_id, OLD.academy_id) AND is_visible = true)
  WHERE id = COALESCE(NEW.academy_id, OLD.academy_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_academy_rating ON academy_ratings;
CREATE TRIGGER trg_academy_rating
AFTER INSERT OR UPDATE OR DELETE ON academy_ratings
FOR EACH ROW EXECUTE FUNCTION update_academy_rating();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'pending_user', 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role() RETURNS VARCHAR AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true AND status = 'active'
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_branch() RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_governorate() RETURNS INTEGER AS $$
  SELECT governorate_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_academy() RETURNS UUID AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'super_admin'
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_committee() RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('committee_head', 'committee_deputy', 'committee_member')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_branch_level() RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('branch_president', 'branch_first_deputy', 'branch_second_deputy', 'branch_secretary', 'branch_secretary_assistant', 'branch_treasurer', 'branch_treasurer_assistant', 'branch_agent', 'branch_agent_assistant')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_academy_level() RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('academy_owner', 'academy_manager')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_permission(p_resource VARCHAR, p_action VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM permissions WHERE role = get_user_role() AND resource = p_resource AND action = p_action AND allowed = true)
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
