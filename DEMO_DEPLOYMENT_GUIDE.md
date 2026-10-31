# Netlify 배포 전 절차

현재는 배포하지 않은 로컬 프로젝트다. Netlify의 Next.js App Router 런타임이 SSR, Route Handler와 `.next`를 처리하도록 `netlify.toml`을 준비했다. 실제 Netlify 런타임 통합은 미검증이다.

1. `DEMO_ENV_CHECKLIST.md`와 `DEMO_AUTH_SETUP.md`를 읽고 Demo 프로젝트와 공개 키를 독립 확인한다. Netlify 사이트 주소가 정해진 뒤에만 OAuth 리다이렉트를 등록한다.
2. 현재 Demo DB의 public 스키마와 RLS, Storage 정책을 사용자 권한으로 확인한다. 방문자를 켜려면 `database/demo_visitor.sql`을 별도 검토·승인한 뒤 확인된 Demo에만 적용한다. 기존 객체 충돌 시 중단한다. 이 저장소는 DB SQL을 자동 실행하지 않는다.
3. `npm ci`, `npm run lint`, TypeScript, 전체 테스트와 `npm run build`를 확인한다. 실제 공개 키를 로컬 콘솔이나 보고서에 출력하지 않는다. Netlify Builds/Functions 범위에 공개 설정을 동일하게 넣고 방문자 비밀은 Functions에만 저장한다.
4. 별도 GitHub 저장소와 Netlify 사이트의 생성·연결·배포는 사용자가 승인 후 수행한다. Build command `npm run build`, publish `.next`, Node 22 설정을 사용한다. Next 런타임이 적용되는지 Netlify 빌드 로그와 SSR/Route Handler로 확인한다.
5. Demo 미승인 회원·승인 회원·관리자로 로그인/가입, 게시판과 Storage 접근 및 부정 접근 차단을 실환경에서 확인한다. 실제 데이터나 운영 이미지는 가져오지 않는다.

방문자 API는 같은 출처 요청, 서버 전용 키, HTTP-only 식별 쿠키, 일별 HMAC 유도 해시, DB 트랜잭션 잠금과 전역 분당·일별 상한을 사용한다. 쿠키 삭제·새 브라우저는 새 방문으로 볼 수 있고, 공격자가 전역 할당량을 소진할 수 있다. DB에 도달하기 전 요청 자체를 제한하지 못하므로 외부 레이트 리밋/WAF가 필요하다. 식별 원장은 다음 방문 시 2일보다 오래된 기록을 삭제하며, 방문이 없으면 삭제가 지연된다. 운영 수준 보장이나 완전한 봇 차단으로 간주하지 않는다.
