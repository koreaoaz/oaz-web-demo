"""격리된 가짜 Auth/Storage 검사이며 실제 Supabase 통합 검사가 아니다."""
import sys
from pathlib import Path
from helpers.local_postgres import LocalPostgres, PostgreSQLUnavailable
ROOT = Path(__file__).resolve().parents[1]

def query(sql, succeeds=True):
    result = pg.query(sql, ok=succeeds)
    if not succeeds and not result.returncode:
        raise AssertionError("예상한 권한 거부가 발생하지 않았습니다.")
    return result.stdout.strip()

def actor(role, uid, sql, succeeds=True):
    return query(f"BEGIN; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub = '{uid}'; {sql}; ROLLBACK;", succeeds)


try:
    pg = LocalPostgres().__enter__()
except PostgreSQLUnavailable as error:
    print(error)
    sys.exit(77)
try:
    query("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;")
    query("""CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
      CREATE TABLE auth.identities(user_id uuid,provider text,identity_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE TABLE storage.objects(bucket_id text NOT NULL,name text NOT NULL,PRIMARY KEY(bucket_id,name));
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY mock_broad ON storage.objects FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
    """)
    sequences = ['allowed_user_id_seq','alumni_id_seq','donator_id_seq','editor_0_noti_id_seq','editor_1_projects_id_seq','editor_2_studies_id_seq','editor_3_study_timetable_id_seq','editor_6_events_id_seq','month_schedule_id_seq','registered_member_id_seq','supervisor_id_id_seq','today_visitor_id_seq','who_is_boss_id_seq']
    for name in sequences:
        query(f'CREATE SEQUENCE public.{name};')
    tables = ['alumni','editor_0_noti','editor_1_projects','editor_2_studies','editor_3_study_timetable','editor_4_schedules','editor_6_events','techblog_rss','today_visitor','who_is_boss']
    for name in tables:
        query(f'CREATE TABLE public.{name}(id bigint, text text); ALTER TABLE public.{name} ENABLE ROW LEVEL SECURITY;')
    query("""CREATE TABLE public.editor_5_donators(id bigint,name text,date text,created_at timestamptz,uuid uuid);
      CREATE TABLE public.supervisor_id(id bigint,name text,email text,uuid uuid);
      CREATE TABLE public.allowed_user(id bigint DEFAULT nextval('public.allowed_user_id_seq'),name text,email text);
      CREATE TABLE public.registered_member(id bigint DEFAULT nextval('public.registered_member_id_seq'),uuid uuid PRIMARY KEY,email text UNIQUE,is_manager boolean);
      ALTER TABLE public.editor_5_donators ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.supervisor_id ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.allowed_user ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.registered_member ENABLE ROW LEVEL SECURITY;
    """)
    admin = '10000000-0000-0000-0000-000000000001'
    member = '10000000-0000-0000-0000-000000000002'
    outsider = '10000000-0000-0000-0000-000000000003'
    approved = '10000000-0000-0000-0000-000000000004'
    unverified = '10000000-0000-0000-0000-000000000005'
    query(f"""INSERT INTO auth.users VALUES ('{member}','member@example.invalid',now()),('{outsider}','other@example.invalid',now()),('{approved}','approved@example.invalid',now()),('{unverified}','unverified@example.invalid',NULL);
      INSERT INTO auth.identities VALUES ('{member}','github','{{"email":"member@example.invalid","email_verified":true}}'),('{outsider}','github','{{"email":"other@example.invalid","email_verified":true}}'),('{approved}','github','{{"email":"approved@example.invalid","email_verified":true}}'),('{unverified}','github','{{"email":"unverified@example.invalid","email_verified":true}}');
      INSERT INTO public.supervisor_id VALUES (1,'mock','mock@example.invalid','{admin}');
      INSERT INTO public.allowed_user(email) VALUES ('member@example.invalid'),('approved@example.invalid'),('unverified@example.invalid');
      INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{member}','member@example.invalid',false);
      INSERT INTO public.editor_0_noti(text) VALUES ('mock');
      INSERT INTO storage.objects VALUES ('project_img','mock.png');
    """)
    query((ROOT / 'database' / 'demo_security_reference.sql').read_text(encoding='utf-8'))
    assert actor('anon', '', 'SELECT count(*) FROM public.editor_0_noti') == '1'
    actor('anon', '', 'SELECT * FROM public.registered_member', False)
    actor('anon', '', 'SELECT uuid FROM public.editor_5_donators', False)
    actor('anon', '', "INSERT INTO public.editor_0_noti(text) VALUES ('mock')", False)
    actor('anon', '', "INSERT INTO storage.objects VALUES ('project_img','anonymous.png')", False)
    assert actor('anon', '', "WITH changed AS (UPDATE storage.objects SET name='anonymous.png' WHERE bucket_id='project_img' RETURNING 1) SELECT count(*) FROM changed") == '0'
    assert actor('anon', '', "WITH changed AS (DELETE FROM storage.objects WHERE bucket_id='project_img' RETURNING 1) SELECT count(*) FROM changed") == '0'
    for uid in (member, outsider):
        for table in ('editor_0_noti','editor_1_projects','editor_2_studies','editor_6_events'):
            actor('authenticated', uid, f"INSERT INTO public.{table}(text) VALUES ('mock')", False)
            assert actor('authenticated', uid, f"WITH changed AS (UPDATE public.{table} SET text='mock' RETURNING 1) SELECT count(*) FROM changed") == '0'
            assert actor('authenticated', uid, f"WITH changed AS (DELETE FROM public.{table} RETURNING 1) SELECT count(*) FROM changed") == '0'
        assert actor('authenticated', uid, "WITH changed AS (UPDATE public.registered_member SET is_manager=true RETURNING 1) SELECT count(*) FROM changed") == '0'
        assert actor('authenticated', uid, 'SELECT count(*) FROM public.allowed_user') == '0'
        assert actor('authenticated', uid, 'SELECT count(*) FROM public.supervisor_id') == '0'
        actor('authenticated', uid, "INSERT INTO storage.objects VALUES ('project_img','new.png')", False)
        assert actor('authenticated', uid, "WITH changed AS (UPDATE storage.objects SET name='changed.png' WHERE bucket_id='project_img' RETURNING 1) SELECT count(*) FROM changed") == '0'
        assert actor('authenticated', uid, "WITH changed AS (DELETE FROM storage.objects WHERE bucket_id='project_img' RETURNING 1) SELECT count(*) FROM changed") == '0'
    assert actor('authenticated', member, 'SELECT count(*) FROM public.registered_member') == '1'
    assert actor('authenticated', outsider, 'SELECT count(*) FROM public.registered_member') == '0'
    assert actor('authenticated', admin, 'SELECT count(*) FROM public.registered_member') == '1'
    actor('authenticated', approved, f"INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{approved}','approved@example.invalid',true)", False)
    actor('authenticated', unverified, f"INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{unverified}','unverified@example.invalid',false)", False)
    actor('authenticated', outsider, f"INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{approved}','approved@example.invalid',false)", False)
    actor('authenticated', outsider, f"INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{outsider}','member@example.invalid',false)", False)
    assert actor('authenticated', approved, f"INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{approved}','APPROVED@example.invalid',false) RETURNING 1") == '1'
    actor('authenticated', member, f"INSERT INTO public.registered_member(uuid,email,is_manager) VALUES ('{member}','member@example.invalid',false)", False)
    for table in ('editor_0_noti','editor_1_projects','editor_2_studies','editor_6_events'):
        actor('authenticated', admin, f"INSERT INTO public.{table}(text) VALUES ('mock'); UPDATE public.{table} SET text='changed'; DELETE FROM public.{table}")
    actor('authenticated', admin, "INSERT INTO public.allowed_user(email) VALUES ('new@example.invalid')")
    actor('authenticated', admin, f"INSERT INTO public.supervisor_id(id,uuid) VALUES (99,'{outsider}')", False)
    actor('authenticated', admin, "INSERT INTO storage.objects VALUES ('project_img','new.png'); UPDATE storage.objects SET name='changed.png' WHERE name='new.png'; DELETE FROM storage.objects WHERE name='changed.png'")
    actor('authenticated', admin, "INSERT INTO storage.objects VALUES ('project_img','../escape.png')", False)
    print('PASS: 로컬 GRANT/RLS 역할별 콘텐츠·회원·관리자·Storage 검사')
finally:
    pg.cleanup()
