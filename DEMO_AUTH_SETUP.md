# Demo 인증·Storage 설정

사용자가 Demo SQL Editor에서 확인한 현황은 public 테이블 14개 모두 RLS 활성화, public 정책 37개, Storage 정책 7개, SECURITY DEFINER 보안 함수 2개, public 버킷 3개다. 이는 정책과 객체의 존재에 관한 확인이다. 실제 인증된 일반 회원과 관리자의 허용·거부 동작은 아직 검증하지 않았으며 배포 승인 전 별도로 테스트해야 한다.

Demo 전용 GitHub OAuth 앱과 Demo Supabase Auth를 사용한다. GitHub OAuth 앱 콜백은 Supabase Dashboard가 제시하는 Demo 프로젝트의 callback 주소를 사용하고, Supabase의 허용 Redirect URLs에 실제 확정된 Demo 사이트의 `/oauth_callback`과 `/login_callback`을 등록한다. 아직 없는 Netlify 도메인은 확정값으로 저장하지 않는다. Preview 사이트를 허용할 때는 정확한 도메인별 위험을 검토한다.

로그인과 가입 코드는 현재 사이트의 origin을 사용한다. 가입 시 `getUser()`의 UUID와 확인된 이메일을 사용하고 DB RLS는 GitHub identity의 이메일·verified 상태와 승인 이메일을 검증해야 한다. 사용자 수정 가능 metadata 또는 `is_manager`는 관리자 근거가 아니다. Demo Auth에서 실제 identity 필드 구조와 이메일 인증 의미, 기존 회원 UUID 로그인, 콜백·세션 유지·로그아웃을 가짜 계정으로 확인하기 전 실제 검증 완료로 보지 않는다.

`project_img`, `study-images`, `card_news`는 사용자가 public으로 생성했다고 제공한 사실이다. 공개 URL은 누구나 읽을 수 있다. 관리자 쓰기, 일반 회원·익명 쓰기 차단과 upsert SELECT 권한은 현재 원격 정책을 접속해 확인하지 않았다. `database/demo_security_reference.sql`(MILESTONE A 정책의 검토용 사본)의 조건 및 기존 permissive/restrictive 정책을 Demo에서 직접 검토하고 실제 이미지 API로 테스트한다. 브라우저의 경로 검사는 보조 방어이며 DB Storage RLS가 최종 강제 지점이다. 운영 이미지·회원 데이터는 복사하지 않는다.
