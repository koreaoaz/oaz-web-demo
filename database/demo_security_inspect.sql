-- 읽기 전용 검토: 실행 전 SQL Editor의 프로젝트가 Demo인지 사용자가 직접 확인한다.
-- 사용자 행, 이메일, UUID 및 비밀정보를 조회하지 않는다.
SELECT schemaname, tablename, rowsecurity FROM pg_catalog.pg_tables
WHERE schemaname='public' ORDER BY tablename;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies WHERE schemaname='public'
OR (schemaname='storage' AND tablename='objects') ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public','storage') AND grantee IN ('anon','authenticated')
ORDER BY table_schema, table_name, grantee, privilege_type;
