# 마일스톤 C 보안 검토

> STEP 182/183 당시의 검토 이력이다. 아래 service_role 수용·방문자 구현 설명은 현재 코드와 다르다. 현재 API는 서버 키와 관계없이 차단되며 키 설정 및 SQL 적용을 금지한다. 최신 검증·배포 기준은 `DEMO_FINAL_RELEASE_RUNBOOK.md`가 우선한다.

## 확인한 경계

Editor 화면은 `getUser()`로 사용자를 확인하고 `supervisor_id`에 해당 UUID가 있을 때만 렌더링한다. 이는 화면 접근 제어이며 API 직접 호출의 방어선은 아니다. `database/demo_security_reference.sql`은 콘텐츠 테이블에 공개 SELECT 및 관리자 INSERT/UPDATE/DELETE, 회원 본인 조회, 관리자 회원 관리와 본인 가입 검증을 설계한다. Storage 쓰기는 관리자 조건에 더해 RESTRICTIVE 정책을 사용한다. RLS의 permissive 정책은 OR로, restrictive 정책은 AND로 결합되며 두 종류 중 permissive 허용도 필요하다.

후원 목록은 UUID를 요청하지 않도록 열을 제한한다. `registered_member`에는 개인정보가 있으므로 일반 회원이 다른 회원 행을 볼 수 없어야 한다. `supervisor_id` 변경 권한을 사용자에게 주지 않는다. GitHub 확인 이메일과 승인 이메일 및 UUID를 DB 측에서 검증하는 설계이고 `user_metadata`나 브라우저 관리자 표시를 권한 근거로 삼지 않는다.

## 로컬과 원격의 차이

`tests/demo-role-db.test.py`는 임시 PostgreSQL의 가짜 테이블·역할과 위 **참고 SQL**을 사용한다. 인증되지 않은 역할, 미승인·일반 회원, 관리자에 대해 테이블 GRANT와 RLS의 결과를 실제 SQL로 검사한다. 이는 Supabase Auth 토큰, PostgREST HTTP, 실제 Storage API 및 현재 원격 정책 전체를 검증한 것이 아니다. UPDATE/DELETE는 RLS에 막혔을 때 오류 대신 변경 행 0개일 수 있어 반환 행 수를 검사한다.

사용자는 Demo에 public 정책 37개와 Storage 정책 7개가 설치되었다고 확인했으며 실제 공지 CRUD와 프로젝트·스터디·행사 및 이미지 기능의 정상 동작을 보고했다. 실제 로그인한 일반 회원에 의한 직접 API 우회 거부와 현재 설치된 정책의 완전한 결합 결과는 미검증이다. 원격 정책 변경이나 SQL 실행은 하지 않았다.

## 남은 위험

- 공개 버킷의 이미지 URL 조회는 Storage HTTP 서비스의 동작으로, 로컬 PostgreSQL의 `storage.objects` 테스트와 구분한다.
- 클라이언트 `src/lib/storagePath.ts` 검사는 우회 가능하다. 참고 Storage 정책은 기본 경로 이탈을 차단하지만 클라이언트와 동일한 모든 문자 제한을 증명하지 못한다. 기존 파일과 실제 Storage 디코딩 동작을 조사하고 직접 API로 추가 검증해야 한다.
- 방문자 서버 키는 service_role이어서 이 앱의 두 함수 실행에만 국한된 키가 아니다. 키가 유출되면 RLS를 우회할 수 있다. 서버 전용 보관과 노출 최소화는 구현했지만 권한 최소화는 미완료다.
- 현재 서버 검사는 프로젝트 ref가 포함된 기존 JWT형 service_role 키만 수용한다. Supabase는 새 비밀키를 권장하고 기존 키를 폐기 예정으로 안내하지만 새 비밀키도 service_role의 광범위 권한을 갖는다. 프로젝트 귀속과 최소 권한 검증을 해결하기 전 임의로 허용하지 않는다. [Supabase API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)
- 방문자 DB 호출 전 전역 분산 요청 제한은 없다. 쿠키 삭제로 새 식별자를 만들어 분당·일일 쿼터를 소진시킬 수 있다. DB 상한은 인프라 차원의 WAF나 분산 제한을 대체하지 못한다.
- 로컬 테스트용 정책이 실제 설치 정책과 다르거나 다른 permissive 정책이 있으면 결론이 달라진다. 적용 전 공개 범위, RLS와 기존 정책·GRANT를 재확인한다.
