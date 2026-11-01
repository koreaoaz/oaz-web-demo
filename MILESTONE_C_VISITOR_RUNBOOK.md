# Demo 방문자 집계 적용·원복 절차

> 이 문서는 과거 검토 이력이다. 현재 방문자 API는 강제 차단되어 있으며 키 설정과 SQL 적용을 금지한다. `DEMO_FINAL_RELEASE_RUNBOOK.md`가 우선한다.

## 현재 상태와 구현 범위

`database/demo_visitor.sql`은 승인 전 적용하지 않는 Demo 전용 마이그레이션이다. 서버 환경이 미설정이면 API는 503을 반환한다. HTTP-only 쿠키의 무작위 값을 서버 전용 HMAC으로 해시하고 DB는 날짜별 해시만 저장한다. 원장은 한국 시간 일자와 해시의 기본키로 중복을 막고 트랜잭션 잠금으로 동시 요청을 직렬화한다. 잠금 획득 후 한국 날짜를 정한다. DB 전역 분당 요청·신규 집계 및 일별 상한과 2일 보존 정리가 있다. DB 오류와 비정상 응답은 503, 상한은 429다.

쿠키를 지우면 같은 사람도 재집계될 수 있다. 날짜별 해시를 써도 같은 날 재방문은 연결 가능하다. 정리는 다음 유효 기록 요청 때 수행되므로 서비스가 중단되면 자동 삭제 시점이 지연된다. API가 날짜를 별도로 계산하므로 자정 직전 DB 응답과 HTTP 응답 사이에 날짜 표시가 달라질 가능성이 남는다.

## 적용 전 필수 조건

1. 사용자가 Demo 프로젝트 식별자와 호스트를 별도로 확인하고 DB 백업과 복원 절차를 확인한다. 운영 프로젝트에는 적용하지 않는다.
2. `public.demo_visit_ledger`, `public.demo_visit_throttle`, `public.demo_visit_record(text)`, `public.demo_visit_read()`의 이름 충돌·소유자·의존성을 확인한다. 기존 객체가 하나라도 있으면 중단한다. SQL은 하나의 트랜잭션이며 CREATE 충돌 시 전체 적용이 실패한다.
3. 키 보유자는 두 SECURITY DEFINER 함수의 소유자 권한, 빈 search_path, EXECUTE GRANT 및 모든 다른 역할의 접근을 점검한다. 함수 소유권과 service_role BYPASSRLS는 별개다. 이 서비스 역할 키는 프로젝트 전체에 광범위한 권한이 있으므로 별도 최소 권한 대안이 확보되지 않았다면 활성화 결정을 보류한다.
4. DB 도달 전 분산 WAF/요청 제한을 준비하고 쿠키 재생성에 의한 쿼터 소진 위험과 예상 비용을 승인한다. 환경변수 미설정 503 상태는 이 조건이 충족될 때까지 유지한다.

## 사용자 승인 후 적용

Demo SQL Editor에서 검토된 `database/demo_visitor.sql`을 한 트랜잭션으로 실행한다. 실행 중 오류가 나면 전부 롤백됐는지 확인하고 일부 적용으로 가정해 반복하지 않는다. 적용 후 함수의 실행자·권한, 테이블 RLS·GRANT, 직접 RPC 차단과 API 동작을 가짜 계정으로 검증한다. 실제 비밀값은 사용자만 Netlify 서버 Functions 범위에 설정하며 로그나 문서에 기록하지 않는다.

필요한 서버 변수 이름: `DEMO_VISITOR_SERVICE_KEY`, `DEMO_VISITOR_HMAC_KEY`. 공개 변수는 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`다. 서버 변수는 브라우저에 노출하지 않는다. HMAC 값은 암호학적으로 안전한 무작위 값으로 별도 생성한다. 앱의 길이 검사는 무작위성이나 강도를 보장하지 않는다. 현재 구현은 Demo ref의 legacy service_role JWT만 수용하며, JWT payload 로컬 판독은 서명 검증이 아니다.

## 장애와 원복

먼저 Functions의 서버 변수를 제거하고 재배포해 API를 503으로 돌린다. 이미 실행 중인 배포·호출이 종료됐는지 확인한다. 함수·테이블 정의와 백업 및 다른 객체의 의존성을 확인한 뒤 별도 승인으로 `database/demo_visitor_rollback.sql`을 실행한다. RESTRICT 충돌 시 중단하고 CASCADE로 우회하지 않는다. 이 원복은 집계와 원장을 삭제한다. 비밀키 유출이 의심되면 별도 키 회전과 영향 조사가 필요하다.

로컬 테스트 `python tests/visitor-db.test.py`는 가짜 데이터만 이용해 마이그레이션, 충돌 실패, 동시 중복, 권한 거부, 할당량과 원복·재적용을 확인한다. 이 검사는 원격 적용이나 원격 복원을 뜻하지 않는다.
