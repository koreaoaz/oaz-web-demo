# 격리된 로컬 PostgreSQL에서만 실행한다. 외부 DB에는 연결하지 않는다.
import os, socket, subprocess, tempfile, time, concurrent.futures, secrets
from pathlib import Path
base=Path(r"C:\Users\yjcha\OAZ-Workspace\OAZ_150_LOCAL_TEST_z5sboum1\portable\bin")
root=Path(tempfile.mkdtemp(prefix="OAZ_160_PG_",dir=r"C:\Users\yjcha\OAZ-Workspace"));data=root/"data"
with socket.socket() as s:s.bind(("127.0.0.1",0));port=s.getsockname()[1]
env={k:v for k,v in os.environ.items() if not k.upper().startswith("PG")};env["PGCLIENTENCODING"]="UTF8"
env["PGPASSWORD"]=secrets.token_hex(32)
psql=[str(base/"psql.exe"),"-X","-h","127.0.0.1","-p",str(port),"-U","oaz_test","-d","postgres","-w","-qAt","-v","ON_ERROR_STOP=1"]
def q(text,ok=True):
 p=subprocess.run(psql,input=text,text=True,encoding="utf-8",capture_output=True,env=env,timeout=60)
 if ok and p.returncode:raise RuntimeError(p.stderr[-1000:])
 return p
started=False
try:
 password_file=root/"temporary-password"
 try:
  password_file.write_text(env["PGPASSWORD"]+"\n",encoding="ascii")
  init=subprocess.run([str(base/"initdb.exe"),"-D",str(data),"-U","oaz_test","--auth=scram-sha-256","--pwfile",str(password_file),"--no-locale","--encoding=UTF8"],capture_output=True,env=env,timeout=120)
 finally:password_file.unlink(missing_ok=True)
 if init.returncode:raise RuntimeError("initdb failed")
 subprocess.Popen([str(base/"pg_ctl.exe"),"-D",str(data),"-l",str(root/"server.log"),"-o",f"-h 127.0.0.1 -p {port}","-w","start"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
 for _ in range(120):
  try:
   with socket.create_connection(("127.0.0.1",port),timeout=.2):started=True;break
  except OSError:time.sleep(.25)
 if not started:raise RuntimeError("server start failed")
 for _ in range(100):
  if q("SELECT 1;",False).returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError("server not ready")
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
 if started:
  subprocess.Popen([str(base/"pg_ctl.exe"),"-D",str(data),"-m","fast","-w","stop"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
  for _ in range(120):
   try:
    with socket.create_connection(("127.0.0.1",port),timeout=.2):pass
   except OSError:break
   time.sleep(.25)
  print("로컬 테스트 서버 종료")
