-- STEP 152: Demo 전용 2차 보안 후보. 승인 전 실제 DB 실행 금지.
-- 대상 ref/호스트 독립확인, 1차 검사 및 백업 확인 필수. visitor RPC와 관리자 시드는 포함하지 않는다.
BEGIN;
DO $pre$
BEGIN
 IF to_regclass('auth.users') IS NULL OR to_regclass('auth.identities') IS NULL OR to_regprocedure('auth.uid()') IS NULL OR to_regclass('storage.objects') IS NULL THEN
   RAISE EXCEPTION 'Auth/Storage 종속 객체 부재';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Storage RLS 미활성'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY['editor_0_noti','editor_1_projects','editor_2_studies','editor_3_study_timetable','editor_4_schedules','editor_5_donators','editor_6_events','allowed_user','registered_member','supervisor_id'])) THEN
   RAISE EXCEPTION '기존 public 정책 존재: 검토 없이 중복 적용 금지';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='oaz_demo_private') THEN RAISE EXCEPTION '기존 전용 함수 스키마 충돌'; END IF;
 IF NOT has_table_privilege(current_user,'auth.users','SELECT') OR NOT has_table_privilege(current_user,'auth.identities','SELECT') THEN RAISE EXCEPTION '함수 소유자의 Auth 조회 권한 부족'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.rolname=current_user WHERE c.oid='public.supervisor_id'::regclass AND (r.rolsuper OR r.rolbypassrls OR (c.relowner=r.oid AND NOT c.relforcerowsecurity))) THEN RAISE EXCEPTION '관리자 검사 함수 소유자의 RLS 우회 조건 미충족'; END IF;
 IF NOT (has_table_privilege('authenticated','storage.objects','SELECT') AND has_table_privilege('authenticated','storage.objects','INSERT') AND has_table_privilege('authenticated','storage.objects','UPDATE') AND has_table_privilege('authenticated','storage.objects','DELETE')) THEN RAISE EXCEPTION 'Storage 인증 역할 기본 권한 검토 필요'; END IF;
END; $pre$;
CREATE SCHEMA oaz_demo_private;
REVOKE ALL ON SCHEMA oaz_demo_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA oaz_demo_private TO anon, authenticated;
-- 호출자 자신의 UUID만 판별. 소유자는 supervisor_id RLS를 우회할 수 있어야 한다.
CREATE FUNCTION oaz_demo_private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$ SELECT coalesce((SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.supervisor_id s WHERE s.uuid=(SELECT auth.uid())),false) $fn$;
REVOKE ALL ON FUNCTION oaz_demo_private.is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION oaz_demo_private.is_admin() TO anon,authenticated;
-- GitHub identity의 확인된 이메일과 Auth 확인 이메일, 승인 목록을 서버에서 교차검증한다.
CREATE FUNCTION oaz_demo_private.can_register(candidate_uuid uuid,candidate_email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT coalesce((SELECT auth.uid()) IS NOT NULL AND candidate_uuid=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM auth.users u JOIN auth.identities i ON i.user_id=u.id AND i.provider='github'
 WHERE u.id=(SELECT auth.uid()) AND u.email_confirmed_at IS NOT NULL
 AND nullif(pg_catalog.btrim(u.email),'') IS NOT NULL
 AND pg_catalog.lower(pg_catalog.btrim(candidate_email))=pg_catalog.lower(pg_catalog.btrim(u.email))
 AND pg_catalog.lower(pg_catalog.btrim(i.identity_data->>'email'))=pg_catalog.lower(pg_catalog.btrim(u.email))
 AND i.identity_data->>'email_verified'='true'
 AND EXISTS (SELECT 1 FROM public.allowed_user a WHERE pg_catalog.lower(pg_catalog.btrim(a.email))=pg_catalog.lower(pg_catalog.btrim(u.email)))
 ),false)
$fn$;
REVOKE ALL ON FUNCTION oaz_demo_private.can_register(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION oaz_demo_private.can_register(uuid,text) TO authenticated;
DO $content$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['editor_0_noti','editor_1_projects','editor_2_studies','editor_3_study_timetable','editor_4_schedules','editor_5_donators','editor_6_events'] LOOP
  IF t='editor_5_donators' THEN
   EXECUTE format('GRANT SELECT (id,name) ON public.%I TO anon',t);
   EXECUTE format('GRANT SELECT (id,name,date,created_at) ON public.%I TO authenticated',t);
  ELSE
   EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated',t);
  END IF;
  EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY demo_read ON public.%I FOR SELECT TO anon, authenticated USING (true)',t);
  EXECUTE format('CREATE POLICY demo_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (oaz_demo_private.is_admin())',t);
  EXECUTE format('CREATE POLICY demo_update ON public.%I FOR UPDATE TO authenticated USING (oaz_demo_private.is_admin()) WITH CHECK (oaz_demo_private.is_admin())',t);
  EXECUTE format('CREATE POLICY demo_delete ON public.%I FOR DELETE TO authenticated USING (oaz_demo_private.is_admin())',t);
 END LOOP;
END; $content$;
GRANT SELECT ON public.supervisor_id TO authenticated;
CREATE POLICY demo_supervisor_read ON public.supervisor_id FOR SELECT TO authenticated USING (uuid=(SELECT auth.uid()) OR oaz_demo_private.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_user TO authenticated;
CREATE POLICY demo_allowed_read ON public.allowed_user FOR SELECT TO authenticated USING (oaz_demo_private.is_admin());
CREATE POLICY demo_allowed_insert ON public.allowed_user FOR INSERT TO authenticated WITH CHECK (oaz_demo_private.is_admin());
CREATE POLICY demo_allowed_update ON public.allowed_user FOR UPDATE TO authenticated USING (oaz_demo_private.is_admin()) WITH CHECK (oaz_demo_private.is_admin());
CREATE POLICY demo_allowed_delete ON public.allowed_user FOR DELETE TO authenticated USING (oaz_demo_private.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registered_member TO authenticated;
CREATE POLICY demo_member_read ON public.registered_member FOR SELECT TO authenticated USING (uuid=(SELECT auth.uid()) OR oaz_demo_private.is_admin());
CREATE POLICY demo_member_insert ON public.registered_member FOR INSERT TO authenticated WITH CHECK (oaz_demo_private.is_admin() OR (is_manager IS FALSE AND oaz_demo_private.can_register(uuid,email)));
CREATE POLICY demo_member_update ON public.registered_member FOR UPDATE TO authenticated USING (oaz_demo_private.is_admin()) WITH CHECK (oaz_demo_private.is_admin());
CREATE POLICY demo_member_delete ON public.registered_member FOR DELETE TO authenticated USING (oaz_demo_private.is_admin());
-- service_role의 BYPASSRLS와 테이블 권한은 별개다. 신뢰된 서버에서만 사용.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_user,public.alumni,public.editor_0_noti,public.editor_1_projects,public.editor_2_studies,public.editor_3_study_timetable,public.editor_4_schedules,public.editor_5_donators,public.editor_6_events,public.registered_member,public.supervisor_id,public.techblog_rss,public.today_visitor,public.who_is_boss TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.allowed_user_id_seq,public.donator_id_seq,public.editor_0_noti_id_seq,public.editor_1_projects_id_seq,public.editor_2_studies_id_seq,public.editor_3_study_timetable_id_seq,public.editor_6_events_id_seq,public.month_schedule_id_seq,public.registered_member_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.allowed_user_id_seq,public.alumni_id_seq,public.donator_id_seq,public.editor_0_noti_id_seq,public.editor_1_projects_id_seq,public.editor_2_studies_id_seq,public.editor_3_study_timetable_id_seq,public.editor_6_events_id_seq,public.month_schedule_id_seq,public.registered_member_id_seq,public.supervisor_id_id_seq,public.today_visitor_id_seq,public.who_is_boss_id_seq TO service_role;
-- Storage 기존 정책을 삭제하지 않는다. 대상 버킷에 대해 제한 정책을 추가해 기존 permissive OR를 제어한다.
CREATE POLICY oaz_demo_storage_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('project_img','study-images','card_news') AND oaz_demo_private.is_admin());
CREATE POLICY oaz_demo_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('project_img','study-images','card_news') AND oaz_demo_private.is_admin());
CREATE POLICY oaz_demo_storage_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('project_img','study-images','card_news') AND oaz_demo_private.is_admin()) WITH CHECK (bucket_id IN ('project_img','study-images','card_news') AND oaz_demo_private.is_admin());
CREATE POLICY oaz_demo_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('project_img','study-images','card_news') AND oaz_demo_private.is_admin());
CREATE POLICY oaz_demo_storage_guard_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (bucket_id NOT IN ('project_img','study-images','card_news') OR (oaz_demo_private.is_admin() AND name<>'' AND name !~ '(^/|(^|/)\.\.(/|$)|\\)'));
CREATE POLICY oaz_demo_storage_guard_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (bucket_id NOT IN ('project_img','study-images','card_news') OR oaz_demo_private.is_admin()) WITH CHECK (bucket_id NOT IN ('project_img','study-images','card_news') OR (oaz_demo_private.is_admin() AND name<>'' AND name !~ '(^/|(^|/)\.\.(/|$)|\\)'));
CREATE POLICY oaz_demo_storage_guard_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING (bucket_id NOT IN ('project_img','study-images','card_news') OR oaz_demo_private.is_admin());
COMMIT;
