# Demo GitHub Actions 배포 절차

이 구성은 PR 검증과 수동 Draft 배포를 분리한다. 프로덕션 자동 배포는 아직 없다. PR 코드는 배포 토큰을 사용하지 않는다. 수동 배포는 검토된 `main`에서만 실행하며, 기존 `oneandzero-demo` 사이트의 ID·이름·주소를 Netlify API로 확인한 뒤 CLI의 Draft 배포를 사용한다. 사이트를 생성하지 않는다. Draft URL도 외부에서 접근할 수 있으므로 테스트에는 가짜 정보만 사용한다.

## 최초 설정과 주의사항

1. 학회 Netlify 계정의 프로필 → **User settings → Applications → Personal access tokens**에서 토큰을 생성한다. 만료일을 설정하고 필요한 팀 접근만 선택한다. 토큰은 GitHub에 직접 입력하고 채팅·코드·로그에 남기지 않는다. SSO 팀이면 해당 팀 접근 승인도 필요하다.
2. GitHub 저장소 **Settings → Environments → New environment**에서 `netlify-draft`를 만들고 Deployment branches를 `main`으로 제한한다. 사용 가능한 요금제라면 승인자를 설정한다. 해당 private 저장소에서 환경 보호와 브랜치 제한이 실제 적용되는지 먼저 확인하고, 적용할 수 없으면 토큰을 등록하거나 수동 배포하지 않는다. `main`에 리뷰 및 직접 push 제한도 적용한다.
3. `netlify-draft`의 **Environment secrets**에 `NETLIFY_AUTH_TOKEN`을 추가한다. 저장소 수준 secret으로 등록하면 다른 워크플로에서 접근할 수 있으므로 사용하지 않는다.
4. GitHub **Settings → Secrets and variables → Actions → Variables**에 `NETLIFY_SITE_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`를 등록한다. URL과 키는 Demo 공개 값만 사용한다. 환경 이름이 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 아닌 `NEXT_PUBLIC_SUPABASE_KEY`임을 확인한다. Netlify의 동일한 공개 변수도 Build 및 Functions 실행에 필요한 범위와 Draft 문맥에 설정한다. 방문자 키는 설정하지 않는다.
5. 수동 실행은 해당 워크플로 파일이 GitHub 기본 브랜치에 있어야 가능하다. PR 병합은 이 파일을 등록하지만, 기존 Netlify Git 빌드가 켜져 있으면 병합 자체가 기존 운영 Demo에 자동 배포를 유발할 수 있다. 병합 전 학회가 기존 자동 배포의 영향을 확인하고 명시적으로 승인해야 한다. 이 문서는 기존 빌드 설정을 자동 변경하지 않는다.

## 수동 Draft 검증

학회 승인 후 GitHub **Actions → Demo 검증 및 수동 Draft 배포 → Run workflow → main → Run workflow**를 선택한다. 환경 승인 설정이 있다면 별도 승인한다. 실행한 SHA, 검증 결과 및 Netlify Draft 주소를 확인한다. Draft에서 SSR 페이지, API Route, Demo 연결, GitHub OAuth 리다이렉트, 공개 이미지와 로그인 상태를 실제로 점검한다. OAuth에는 실제 Draft 주소가 허용되어야 하며 Supabase와 GitHub OAuth 설정을 사용자가 승인 후 변경해야 할 수 있다. API의 방문자 집계는 기존 안전 차단 상태여야 한다. 일반 회원 RLS 거부와 관리자 허용은 별도 테스트한다.

빌드 실패 또는 Draft 기능 실패 시 배포 전환을 중단한다. Netlify CLI `netlify build`와 Next.js 런타임은 SSR과 Functions 변환을 수행하지만 실제 Draft에서의 성공 여부는 별도 확인이 필요하다. 로컬 모의 검사는 실환경 OAuth 및 DB 권한 테스트를 대체하지 않는다.

## 성공 이후 전환

학회 승인과 Draft 검증이 완료된 후 Netlify **Project configuration → Developer settings → Continuous deployment → Build settings → Configure → Build status → Stopped builds**로 기존 Git 빌드를 중지할 수 있다. 이 설정은 Netlify의 Git 기반 Production·Deploy Preview·branch 빌드를 모두 중지한다. CLI 로컬 빌드 후 수동 배포는 별도로 가능하다. 연결 해제는 필요하지 않다.

이후 별도 PR에서 `main` push 트리거 및 보호된 프로덕션 환경과 명시적인 `netlify deploy --prod`를 추가하고, 학회가 리뷰·승인한 뒤 검증한다. 현재 파일에는 해당 트리거나 프로덕션 배포 명령이 없다. 환경 보호 기능과 커밋 검증이 불충분하면 자동 프로덕션 전환을 보류한다.

참고: [Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/), [Netlify Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [빌드 중지](https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/), [GitHub 수동 실행](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [GitHub 환경](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).
