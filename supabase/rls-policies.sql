-- ============================================
-- ITWS Platform - RLS Policies
-- Path: supabase/rls-policies.sql
-- ============================================
-- ⚠️ شغّل بعد schema.sql
-- ⚠️ يفعّل الأمان على كل الجداول
-- ============================================

-- ============================================
-- 0. تفعيل RLS على كل الجداول
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accreditation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. PROFILES
-- ============================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
CREATE POLICY "profiles_super_admin_all" ON public.profiles
  FOR ALL USING (public.is_super_admin());

-- ============================================
-- 2. ACADEMY CATEGORIES
-- ============================================

DROP POLICY IF EXISTS "categories_select_active" ON public.academy_categories;
CREATE POLICY "categories_select_active" ON public.academy_categories
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "categories_select_admin" ON public.academy_categories;
CREATE POLICY "categories_select_admin" ON public.academy_categories
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "categories_insert_admin" ON public.academy_categories;
CREATE POLICY "categories_insert_admin" ON public.academy_categories
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_update_admin" ON public.academy_categories;
CREATE POLICY "categories_update_admin" ON public.academy_categories
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "categories_delete_super" ON public.academy_categories;
CREATE POLICY "categories_delete_super" ON public.academy_categories
  FOR DELETE USING (public.is_super_admin());

-- ============================================
-- 3. ACADEMIES
-- ============================================

DROP POLICY IF EXISTS "academies_select_public" ON public.academies;
CREATE POLICY "academies_select_public" ON public.academies
  FOR SELECT USING (status = 'approved' AND is_deleted = false);

DROP POLICY IF EXISTS "academies_select_admin" ON public.academies;
CREATE POLICY "academies_select_admin" ON public.academies
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "academies_insert_public" ON public.academies;
CREATE POLICY "academies_insert_public" ON public.academies
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "academies_update_admin" ON public.academies;
CREATE POLICY "academies_update_admin" ON public.academies
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "academies_delete_super" ON public.academies;
CREATE POLICY "academies_delete_super" ON public.academies
  FOR DELETE USING (public.is_super_admin());

-- ============================================
-- 4. ACADEMY BRANCHES
-- ============================================

DROP POLICY IF EXISTS "branches_select_public" ON public.academy_branches;
CREATE POLICY "branches_select_public" ON public.academy_branches
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "branches_insert_public" ON public.academy_branches;
CREATE POLICY "branches_insert_public" ON public.academy_branches
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "branches_update_admin" ON public.academy_branches;
CREATE POLICY "branches_update_admin" ON public.academy_branches
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "branches_delete_admin" ON public.academy_branches;
CREATE POLICY "branches_delete_admin" ON public.academy_branches
  FOR DELETE USING (public.is_admin());

-- ============================================
-- 5. ACADEMY COURSES
-- ============================================

DROP POLICY IF EXISTS "courses_select_public" ON public.academy_courses;
CREATE POLICY "courses_select_public" ON public.academy_courses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "courses_insert_public" ON public.academy_courses;
CREATE POLICY "courses_insert_public" ON public.academy_courses
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "courses_update_admin" ON public.academy_courses;
CREATE POLICY "courses_update_admin" ON public.academy_courses
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "courses_delete_admin" ON public.academy_courses;
CREATE POLICY "courses_delete_admin" ON public.academy_courses
  FOR DELETE USING (public.is_admin());

-- ============================================
-- 6. ACCREDITATION REQUESTS
-- ============================================

DROP POLICY IF EXISTS "requests_select_public" ON public.accreditation_requests;
CREATE POLICY "requests_select_public" ON public.accreditation_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "requests_insert_public" ON public.accreditation_requests;
CREATE POLICY "requests_insert_public" ON public.accreditation_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "requests_update_admin" ON public.accreditation_requests;
CREATE POLICY "requests_update_admin" ON public.accreditation_requests
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "requests_delete_super" ON public.accreditation_requests;
CREATE POLICY "requests_delete_super" ON public.accreditation_requests
  FOR DELETE USING (public.is_super_admin());

-- ============================================
-- 7. REQUEST STAGE HISTORY
-- ============================================

DROP POLICY IF EXISTS "history_select_public" ON public.request_stage_history;
CREATE POLICY "history_select_public" ON public.request_stage_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "history_insert_admin" ON public.request_stage_history;
CREATE POLICY "history_insert_admin" ON public.request_stage_history
  FOR INSERT WITH CHECK (public.is_admin());

-- ============================================
-- 8. CERTIFICATES
-- ============================================

DROP POLICY IF EXISTS "certificates_select_public" ON public.certificates;
CREATE POLICY "certificates_select_public" ON public.certificates
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "certificates_select_admin" ON public.certificates;
CREATE POLICY "certificates_select_admin" ON public.certificates
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "certificates_insert_admin" ON public.certificates;
CREATE POLICY "certificates_insert_admin" ON public.certificates
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "certificates_update_admin" ON public.certificates;
CREATE POLICY "certificates_update_admin" ON public.certificates
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "certificates_delete_super" ON public.certificates;
CREATE POLICY "certificates_delete_super" ON public.certificates
  FOR DELETE USING (public.is_super_admin());

-- ============================================
-- 9. SEARCH LOGS
-- ============================================

DROP POLICY IF EXISTS "search_logs_insert_public" ON public.search_logs;
CREATE POLICY "search_logs_insert_public" ON public.search_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "search_logs_select_admin" ON public.search_logs;
CREATE POLICY "search_logs_select_admin" ON public.search_logs
  FOR SELECT USING (public.is_admin());

-- ============================================
-- 10. ACTIVITIES
-- ============================================

DROP POLICY IF EXISTS "activities_insert_authenticated" ON public.activities;
CREATE POLICY "activities_insert_authenticated" ON public.activities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "activities_select_admin" ON public.activities;
CREATE POLICY "activities_select_admin" ON public.activities
  FOR SELECT USING (public.is_admin());

-- ============================================
-- 11. SESSIONS
-- ============================================

DROP POLICY IF EXISTS "sessions_select_all" ON public.sessions;
CREATE POLICY "sessions_select_all" ON public.sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sessions_insert_all" ON public.sessions;
CREATE POLICY "sessions_insert_all" ON public.sessions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "sessions_update_all" ON public.sessions;
CREATE POLICY "sessions_update_all" ON public.sessions
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "sessions_delete_admin" ON public.sessions;
CREATE POLICY "sessions_delete_admin" ON public.sessions
  FOR DELETE USING (public.is_admin());

-- ============================================
-- 12. SETTINGS
-- ============================================

DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
CREATE POLICY "settings_select_public" ON public.settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_super_admin_write" ON public.settings;
CREATE POLICY "settings_super_admin_write" ON public.settings
  FOR ALL USING (public.is_super_admin());

-- ============================================
-- 13. THEMES
-- ============================================

DROP POLICY IF EXISTS "themes_select_active" ON public.themes;
CREATE POLICY "themes_select_active" ON public.themes
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "themes_super_admin_write" ON public.themes;
CREATE POLICY "themes_super_admin_write" ON public.themes
  FOR ALL USING (public.is_super_admin());

-- ============================================
-- 14. LOGIN LOGS
-- ============================================

DROP POLICY IF EXISTS "login_logs_insert_public" ON public.login_logs;
CREATE POLICY "login_logs_insert_public" ON public.login_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "login_logs_select_super" ON public.login_logs;
CREATE POLICY "login_logs_select_super" ON public.login_logs
  FOR SELECT USING (public.is_super_admin());

-- ============================================
-- 15. Storage Policies
-- ============================================

DROP POLICY IF EXISTS "academy_docs_read" ON storage.objects;
CREATE POLICY "academy_docs_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'academy-documents');

DROP POLICY IF EXISTS "academy_docs_insert" ON storage.objects;
CREATE POLICY "academy_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'academy-documents');

DROP POLICY IF EXISTS "academy_docs_update" ON storage.objects;
CREATE POLICY "academy_docs_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'academy-documents' AND public.is_admin());

DROP POLICY IF EXISTS "academy_docs_delete" ON storage.objects;
CREATE POLICY "academy_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'academy-documents' AND public.is_super_admin());

DROP POLICY IF EXISTS "public_assets_read" ON storage.objects;
CREATE POLICY "public_assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "public_assets_write" ON storage.objects;
CREATE POLICY "public_assets_write" ON storage.objects
  FOR ALL USING (bucket_id = 'public-assets' AND public.is_admin());

-- ============================================
-- ✅ نهاية RLS Policies
-- ============================================
-- بعد التنفيذ، كل الجداول محمية بـ RLS
-- ============================================
