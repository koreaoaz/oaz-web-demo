-- Demo 전용 방문자 집계 마이그레이션. 실제 Demo 적용 전 별도 승인 필요.
-- 적용 전 대상 ref/호스트 및 기존 객체 이름을 확인한다. 재실행은 충돌 시 중단한다.
BEGIN;
CREATE TABLE public.demo_visit_ledger (
  visit_day date NOT NULL,
  visitor_digest text NOT NULL CHECK (visitor_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (visit_day, visitor_digest)
);
CREATE TABLE public.demo_visit_throttle (
  id integer PRIMARY KEY CHECK (id=1),
  minute_at timestamptz NOT NULL,
  minute_count integer NOT NULL CHECK (minute_count >= 0),
  request_count integer NOT NULL CHECK (request_count >= 0)
);
ALTER TABLE public.demo_visit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_visit_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_visit_ledger, public.demo_visit_throttle FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.demo_visit_record(p_digest text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE d date := (pg_catalog.now() AT TIME ZONE 'Asia/Seoul')::date;
        m timestamptz; daily_digest text;
        n integer; minute_n integer; request_n integer;
BEGIN
  IF p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid digest'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(719443281);
  m := pg_catalog.date_trunc('minute',pg_catalog.clock_timestamp());
  INSERT INTO public.demo_visit_throttle(id,minute_at,minute_count,request_count) VALUES(1,m,0,0)
    ON CONFLICT(id) DO UPDATE SET minute_count=CASE WHEN public.demo_visit_throttle.minute_at=excluded.minute_at THEN public.demo_visit_throttle.minute_count ELSE 0 END, request_count=CASE WHEN public.demo_visit_throttle.minute_at=excluded.minute_at THEN public.demo_visit_throttle.request_count ELSE 0 END, minute_at=excluded.minute_at;
  SELECT minute_count,request_count INTO minute_n,request_n FROM public.demo_visit_throttle WHERE id=1;
  IF request_n >= 120 THEN RETURN -1; END IF;
  UPDATE public.demo_visit_throttle SET request_count=request_count+1 WHERE id=1;
  DELETE FROM public.demo_visit_ledger WHERE visit_day < d - 2;
  daily_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_digest || d::text,'UTF8')),'hex');
  SELECT count(*)::integer INTO n FROM public.demo_visit_ledger WHERE visit_day=d;
  IF EXISTS (SELECT 1 FROM public.demo_visit_ledger WHERE visit_day=d AND visitor_digest=daily_digest) THEN RETURN n; END IF;
  IF minute_n >= 60 OR n >= 3000 THEN RETURN -1; END IF;
  INSERT INTO public.demo_visit_ledger(visit_day,visitor_digest) VALUES(d,daily_digest);
  UPDATE public.demo_visit_throttle SET minute_count=minute_count+1 WHERE id=1;
  RETURN n+1;
END; $fn$;
CREATE FUNCTION public.demo_visit_read() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE m timestamptz; n integer; requests integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(719443281);
  m := pg_catalog.date_trunc('minute',pg_catalog.clock_timestamp());
  INSERT INTO public.demo_visit_throttle(id,minute_at,minute_count,request_count) VALUES(1,m,0,0)
    ON CONFLICT(id) DO UPDATE SET minute_count=CASE WHEN public.demo_visit_throttle.minute_at=excluded.minute_at THEN public.demo_visit_throttle.minute_count ELSE 0 END, request_count=CASE WHEN public.demo_visit_throttle.minute_at=excluded.minute_at THEN public.demo_visit_throttle.request_count ELSE 0 END, minute_at=excluded.minute_at;
  SELECT request_count INTO requests FROM public.demo_visit_throttle WHERE id=1;
  IF requests >= 120 THEN RETURN -1; END IF;
  UPDATE public.demo_visit_throttle SET request_count=request_count+1 WHERE id=1;
  SELECT count(*)::integer INTO n FROM public.demo_visit_ledger WHERE visit_day=(pg_catalog.now() AT TIME ZONE 'Asia/Seoul')::date;
  RETURN n;
END; $fn$;
REVOKE ALL ON FUNCTION public.demo_visit_record(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.demo_visit_read() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demo_visit_record(text), public.demo_visit_read() TO service_role;
COMMIT;
