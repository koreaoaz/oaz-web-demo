"""격리된 로컬 방문자 SQL 검사. Supabase에는 연결하지 않는다."""
import sys
import concurrent.futures
from pathlib import Path
from helpers.local_postgres import LocalPostgres, PostgreSQLUnavailable

def q(text,ok=True):
 return pg.query(text,ok)

try:
 pg = LocalPostgres().__enter__()
except PostgreSQLUnavailable as error:
 print(error)
 sys.exit(77)
try:
 q("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;")
 root_path=Path(__file__).resolve().parents[1]
 migration=(root_path/"database"/"demo_visitor.sql").read_text(encoding="utf-8")
 q(migration)
 assert q(migration,False).returncode!=0
 assert q("SELECT to_regprocedure('public.demo_visit_record(text)') IS NOT NULL;").stdout.strip()=="t"
 digest="a"*64
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  values=list(pool.map(lambda _: q("SET ROLE service_role; SELECT public.demo_visit_record('"+digest+"');").stdout.strip(),range(12)))
 assert values==["1"]*12,values
 assert q("SET ROLE service_role; SELECT public.demo_visit_read();").stdout.strip()=="1"
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  unique=list(pool.map(lambda i: int(q("SET ROLE service_role; SELECT public.demo_visit_record('"+format(i,'064x')+"');").stdout.strip()),range(1,9)))
 assert sorted(unique)==list(range(2,10)),unique
 assert q("SET ROLE service_role; SELECT public.demo_visit_read();").stdout.strip()=="9"
 assert q("SET ROLE anon; SELECT public.demo_visit_record(repeat('b',64));",False).returncode!=0
 assert q("SET ROLE authenticated; SELECT public.demo_visit_read();",False).returncode!=0
 assert q("SET ROLE authenticated; UPDATE public.demo_visit_ledger SET visitor_digest=repeat('c',64);",False).returncode!=0
 assert q("SET ROLE service_role; SELECT * FROM public.demo_visit_ledger;",False).returncode!=0
 assert q("SET ROLE authenticated; SELECT * FROM public.demo_visit_ledger;",False).returncode!=0
 assert q("SET ROLE service_role; SELECT public.demo_visit_record('invalid');",False).returncode!=0
 rows=q("SET ROLE service_role; SELECT public.demo_visit_record(md5(i::text)||md5(i::text)) FROM generate_series(1,65) i;").stdout.strip().splitlines()
 assert "-1" in rows and q("SET ROLE service_role; SELECT public.demo_visit_read();").stdout.strip().isdigit()
 reads=q("SET ROLE service_role; SELECT public.demo_visit_read() FROM generate_series(1,125);").stdout.strip().splitlines()
 assert "-1" in reads
 q("INSERT INTO public.demo_visit_ledger(visit_day,visitor_digest) SELECT (now() AT TIME ZONE 'Asia/Seoul')::date,md5('seed'||i::text)||md5('seed'||i::text) FROM generate_series(1,3000) i ON CONFLICT DO NOTHING; UPDATE public.demo_visit_throttle SET minute_at=date_trunc('minute',clock_timestamp()),minute_count=0,request_count=0 WHERE id=1;")
 assert q("SET ROLE service_role; SELECT public.demo_visit_record(repeat('b',64));").stdout.strip()=="-1"
 q((root_path/"database"/"demo_visitor_rollback.sql").read_text(encoding="utf-8"))
 assert q("SELECT to_regclass('public.demo_visit_ledger') IS NULL AND to_regprocedure('public.demo_visit_read()') IS NULL;").stdout.strip()=="t"
 q(migration)
 print("PASS 동시 중복 12건, 비관리자 RPC·원장 차단, 요청 상한, 충돌 롤백 및 원복·재적용")
finally:
 pg.cleanup()
