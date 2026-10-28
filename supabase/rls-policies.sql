-- ============================================================
-- ITWS Platform — RLS Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE union_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Public read for reference tables
DROP POLICY IF EXISTS "governorates_select_public" ON governorates;
CREATE POLICY "governorates_select_public" ON governorates FOR SELECT USING (true);

DROP POLICY IF EXISTS "branches_select_public" ON branches;
CREATE POLICY "branches_select_public" ON branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "academy_categories_select_public" ON academy_categories;
CREATE POLICY "academy_categories_select_public" ON academy_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_select_public" ON settings;
CREATE POLICY "settings_select_public" ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_all_super" ON settings;
CREATE POLICY "settings_all_super" ON settings FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "labels_select_public" ON labels;
CREATE POLICY "labels_select_public" ON labels FOR SELECT USING (true);

DROP POLICY IF EXISTS "labels_update_super" ON labels;
CREATE POLICY "labels_update_super" ON labels FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "themes_select_public" ON themes;
CREATE POLICY "themes_select_public" ON themes FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "themes_all_super" ON themes;
CREATE POLICY "themes_all_super" ON themes FOR ALL USING (is_super_admin());

-- Profiles
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_super" ON profiles;
CREATE POLICY "profiles_insert_super" ON profiles FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_super" ON profiles;
CREATE POLICY "profiles_update_super" ON profiles FOR UPDATE USING (is_super_admin());

-- Academies
DROP POLICY IF EXISTS "academies_select_public" ON academies;
CREATE POLICY "academies_select_public" ON academies FOR SELECT USING (status = 'approved' AND is_deleted = false OR is_super_admin() OR is_committee());

DROP POLICY IF EXISTS "academies_all_super" ON academies;
CREATE POLICY "academies_all_super" ON academies FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "academies_update_committee" ON academies;
CREATE POLICY "academies_update_committee" ON academies FOR UPDATE USING (is_committee());

DROP POLICY IF EXISTS "academies_update_owner" ON academies;
CREATE POLICY "academies_update_owner" ON academies FOR UPDATE USING (owner_id = auth.uid() OR id = get_user_academy());

-- Academy branches, courses, ratings (public read)
DROP POLICY IF EXISTS "academy_branches_select_public" ON academy_branches;
CREATE POLICY "academy_branches_select_public" ON academy_branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "academy_courses_select_public" ON academy_courses;
CREATE POLICY "academy_courses_select_public" ON academy_courses FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "academy_ratings_select_public" ON academy_ratings;
CREATE POLICY "academy_ratings_select_public" ON academy_ratings FOR SELECT USING (is_visible = true OR rated_by = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "academy_ratings_insert_auth" ON academy_ratings;
CREATE POLICY "academy_ratings_insert_auth" ON academy_ratings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND rated_by = auth.uid());

DROP POLICY IF EXISTS "academy_ratings_update_self" ON academy_ratings;
CREATE POLICY "academy_ratings_update_self" ON academy_ratings FOR UPDATE USING (rated_by = auth.uid());

DROP POLICY IF EXISTS "academy_ratings_delete_self" ON academy_ratings;
CREATE POLICY "academy_ratings_delete_self" ON academy_ratings FOR DELETE USING (rated_by = auth.uid() OR is_super_admin());

-- Certificates (public read)
DROP POLICY IF EXISTS "certificates_select_public" ON certificates;
CREATE POLICY "certificates_select_public" ON certificates FOR SELECT USING (true);

DROP POLICY IF EXISTS "certificates_all_super" ON certificates;
CREATE POLICY "certificates_all_super" ON certificates FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "certificates_all_committee" ON certificates;
CREATE POLICY "certificates_all_committee" ON certificates FOR ALL USING (is_committee());

DROP POLICY IF EXISTS "certificates_insert_academy" ON certificates;
CREATE POLICY "certificates_insert_academy" ON certificates FOR INSERT WITH CHECK (is_academy_level() AND issuer_id = get_user_academy());

-- Logs (public insert, admin read)
DROP POLICY IF EXISTS "login_logs_insert_any" ON login_logs;
CREATE POLICY "login_logs_insert_any" ON login_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "login_logs_select_super" ON login_logs;
CREATE POLICY "login_logs_select_super" ON login_logs FOR SELECT USING (is_super_admin() OR is_committee());

DROP POLICY IF EXISTS "activities_insert_any" ON activities;
CREATE POLICY "activities_insert_any" ON activities FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "activities_select_super" ON activities;
CREATE POLICY "activities_select_super" ON activities FOR SELECT USING (is_super_admin() OR is_committee());

DROP POLICY IF EXISTS "search_logs_insert_any" ON search_logs;
CREATE POLICY "search_logs_insert_any" ON search_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "search_logs_select_super" ON search_logs;
CREATE POLICY "search_logs_select_super" ON search_logs FOR SELECT USING (is_super_admin());

-- Sessions
DROP POLICY IF EXISTS "sessions_all_self" ON sessions;
CREATE POLICY "sessions_all_self" ON sessions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notifications
DROP POLICY IF EXISTS "notifications_select_self" ON notifications;
CREATE POLICY "notifications_select_self" ON notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_self" ON notifications;
CREATE POLICY "notifications_update_self" ON notifications FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_any_auth" ON notifications;
CREATE POLICY "notifications_insert_any_auth" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Permissions (read auth, write super)
DROP POLICY IF EXISTS "permissions_select_auth" ON permissions;
CREATE POLICY "permissions_select_auth" ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "permissions_all_super" ON permissions;
CREATE POLICY "permissions_all_super" ON permissions FOR ALL USING (is_super_admin());

-- System status
DROP POLICY IF EXISTS "system_status_select_public" ON system_status;
CREATE POLICY "system_status_select_public" ON system_status FOR SELECT USING (true);

-- Union courses (public read)
DROP POLICY IF EXISTS "union_courses_select_public" ON union_courses;
CREATE POLICY "union_courses_select_public" ON union_courses FOR SELECT USING (is_active = true AND is_deleted = false);

DROP POLICY IF EXISTS "union_courses_all_super" ON union_courses;
CREATE POLICY "union_courses_all_super" ON union_courses FOR ALL USING (is_super_admin());

-- Accreditation requests (public read for tracking)
DROP POLICY IF EXISTS "accreditation_requests_select_public" ON accreditation_requests;
CREATE POLICY "accreditation_requests_select_public" ON accreditation_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "accreditation_requests_insert_any" ON accreditation_requests;
CREATE POLICY "accreditation_requests_insert_any" ON accreditation_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "accreditation_requests_update_committee" ON accreditation_requests;
CREATE POLICY "accreditation_requests_update_committee" ON accreditation_requests FOR UPDATE USING (is_committee() OR is_super_admin());

DROP POLICY IF EXISTS "request_stage_history_select_public" ON request_stage_history;
CREATE POLICY "request_stage_history_select_public" ON request_stage_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "request_stage_history_insert_committee" ON request_stage_history;
CREATE POLICY "request_stage_history_insert_committee" ON request_stage_history FOR INSERT WITH CHECK (is_committee() OR is_super_admin());
