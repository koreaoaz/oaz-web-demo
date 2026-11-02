# Demo 보안 경계와 DB 실습

Demo GitHub `koreaoaz/oaz-web-demo`, Demo Supabase `ctbwaqtqubmjmltbxfzm`, Netlify `oneandzero-demo`는 공식 OAZ 서비스와 별도 자산이다. 사용자는 Demo와 공식 Supabase가 서로 다른 조직이라고 확인했다. 현재 인증된 `Larry826`은 두 GitHub 저장소에 모두 접근할 수 있는 관리 계정이며 기존 권한을 제거하지 않는다. 친구들에게 Demo 접근을 부여할 때는 **각 친구의 공식 저장소 쓰기 권한이 없는지** 별도로 확인한다. 공식 GitHub 저장소는 현재 공개 상태이므로 공개 읽기 자체는 막을 수 없다.

`src/lib/demoConfig.ts`와 릴리스 도구는 Demo URL을 요구하지만, 코드를 수정할 수 있는 사용자는 그 검사를 변경하거나 다른 클라이언트를 추가할 수 있다. 이는 실수 방지 장치이지 권한 경계가 아니다. 공식 저장소·운영 Supabase·공식 배포의 계정 권한과 비밀값을 Demo 개발자에게 부여하지 않는 것이 필수다.

## 사람별 권한

- GitHub 협업자는 Demo 코드와 workflow를 수정할 수 있다. PR 리뷰와 CI는 현재 강제되지 않을 수 있다. GitHub Actions에 Production 배포 토큰을 넣으면 workflow를 변경하는 사람이 토큰을 빼내거나 악용할 가능성이 있다. PR 코드에 비밀값을 제공하지 않고, 현재 CI의 `contents: read`를 유지한다. GitHub 환경 승인이나 브랜치 보호가 있더라도 정확한 이벤트·권한·승인 정책을 검증하기 전 안전하다고 가정하지 않는다.
- 홈페이지 Editor 관리자와 Supabase Dashboard 멤버는 다르다. 전자는 RLS가 허용하는 게시물·이미지 및 관리자 화면 작업을 할 수 있다. 실제 적용 정책에 따라 회원정보·승인 목록도 노출될 수 있으므로 관리자 권한을 주기 전 확인한다. 버튼 숨김은 RLS를 대체하지 않는다.
- Supabase 프로젝트·조직 권한은 Dashboard 및 DB 작업에 더 강력한 접근을 줄 수 있다. 조직 단위 역할이 같은 조직의 다른 프로젝트로 확장되는지 확인한다. 사용자 확인상 조직은 분리돼 있지만 원격 멤버 목록은 이번에 조회하지 않았다. Demo만의 개인별 권한과 플랜을 확인하고, SQL Editor 및 API 키·비밀 접근 가능 범위를 검토한다. Demo 프로젝트를 공유하더라도 기존 데이터 손상 위험이 있다.
- Netlify Owner 계정, Production 배포 토큰, Supabase service_role·secret 키, DB 관리자 비밀번호, OAuth Client Secret과 공식 서비스 자격증명은 친구에게 공유하지 않는다. Team Owner나 Developer 권한이 사이트 설정·배포까지 포함할 수 있으므로 최소 범위를 별도 확인한다.

## DB·Storage 실습

자유로운 파괴적 실습은 별도의 로컬 PostgreSQL/Supabase 또는 별도 격리 Demo에서 가짜 데이터를 이용한다. 현재 Demo에는 보존할 예시 데이터가 있으므로 Dashboard 권한이 있더라도 임의 초기화·삭제를 하지 않는다. 새 구조는 스키마와 RLS·Storage 정책을 마이그레이션으로 작성하고, 빈 DB와 기존 가짜 데이터 양쪽에서 역할별 SELECT/INSERT/UPDATE/DELETE와 원복을 검증한다. 백업 범위·복원 성공을 확인한 후 PR 리뷰와 관리자 승인을 받아 Demo에 적용한다. 이 문서는 원격 SQL 실행을 승인하지 않는다.

Python과 PostgreSQL 실행 파일이 준비된 컴퓨터에서는 저장소 루트에서 `python tests/demo-role-db.test.py`를 실행해 가짜 Auth·Storage와 참고 정책의 격리 검사를 할 수 있다. 테스트 도구는 새 임시 DB와 loopback만 사용하고 종료 후 정리한다. 미설치나 실행 오류는 통과가 아니다. 로컬 참조 정책 검사는 Supabase Auth, REST, 실제 Storage API 및 설치된 RLS를 증명하지 않는다. 이 명령은 별도 PC에서 실행해 확인한 것은 아니다.

`database/demo_security_reference.sql`은 참고안이며 원격의 현재 정책과 동일하다고 단정하지 않는다. 일반 회원의 직접 API·Storage 쓰기 거부, 다른 회원정보 차단, 승인되지 않은 가입과 관리자 권한 상승은 실제 테스트 계정으로 아직 검증되지 않았다. `MILESTONE_C_ROLE_TEST_GUIDE.md`의 가짜 테스트 데이터 생성·수정·정리는 별도 승인 후 수행한다. UPDATE/DELETE의 HTTP 성공 코드만으로 쓰기 성공 또는 차단을 판단하지 말고 반환 행과 변화 여부를 확인한다.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`는 브라우저 공개 설정이다. Demo publishable 키만 사용하고 비밀키를 이 접두사에 넣지 않는다. 방문자 API는 키를 추가해도 503 차단 상태이며 활성화하지 않는다. 인계 종료 시 담당자가 GitHub 저장소 협업자, Netlify 팀·사이트, Supabase 조직·프로젝트 및 OAuth 앱의 접근을 각각 검토해 회수한다. 당사자의 토큰·세션 및 발급 범위를 확인하고 유출이 의심되는 비밀값은 소유자가 별도 절차로 회전한다. 저장소 접근을 제거해도 이미 받은 로컬 복제본은 회수되지 않는다.
