-- Demo 전용 원복. 실제 실행 전 프로젝트 식별, 백업 및 사용자 승인 필수.
-- 두 테이블의 집계 데이터가 삭제된다. 적용된 객체가 이 마이그레이션의 것인지 먼저 대조한다.
-- RESTRICT는 다른 객체의 의존성이 존재하면 중단한다. CASCADE를 사용하지 않는다.
BEGIN;
DROP FUNCTION public.demo_visit_record(text) RESTRICT;
DROP FUNCTION public.demo_visit_read() RESTRICT;
DROP TABLE public.demo_visit_ledger RESTRICT;
DROP TABLE public.demo_visit_throttle RESTRICT;
COMMIT;
