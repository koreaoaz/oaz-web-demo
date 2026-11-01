# Demo 최종 배포 및 검증 절차

이 문서는 기존 마일스톤 문서와 STEP 185 배포안보다 우선한다. 저장소는 Private을 유지한다. 기존 문서와 SQL은 이력·복구 참고용이며 자동 실행하지 않는다. GitHub Actions는 CI만 수행하고 배포 토큰을 사용하지 않는다.

## 현재 상태

- Excel은 파일 작성 전용 `write-excel-file`을 사용한다. 문자열로 입력된 수식 모양 텍스트는 XLSX 문자열 셀이며 CSV 내보내기는 제공하지 않는다. 실제 파일 왕복 및 시트 XML을 검증한다.
- 외부 도구로 이 파일을 CSV로 다시 저장하면 스프레드시트 프로그램의 수식 해석 위험이 생길 수 있으므로 신뢰하지 않는 값을 재검토한다.
- 운영 의존성 감사는 0건이다. 개발 의존성에는 ESLint 계열 `minimatch` 관련 보통 등급 16건, 별도 Netlify CLI 의존성에는 낮음 2건·보통 17건이 남아 있다. npm의 자동 수정 제안은 호환되지 않는 버전 변경을 포함할 수 있어 적용하지 않았으며 별도 호환성 검증이 필요하다.
- 방문자 기능은 **BLOCKED**다. API는 설정된 서버 키가 있더라도 DB 연결 없이 503을 반환하며 교차 출처 POST는 403이다. 과거 SQL은 검토용이다. `service_role` 사용 금지, DB 앞단의 분산 요청 제한, 쿠키 삭제 후 재집계 및 실제 환경 검증이 해결되기 전에는 활성화하지 않는다. Netlify의 경로별 제한은 모든 플랜에서 코드로 지원되지만 적용에 최대 10초 지연이 있어 전역·즉시 차단을 보장하지 않는다. [Netlify 제한 문서](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)
- 로그인·등록·RLS·Storage의 실제 계정별 권한은 별도 테스트가 필요하다. 앱에서 버튼을 숨기는 것은 DB 권한 검증이 아니다. 원격 DB에 SQL을 자동 적용하지 않는다.
- 실제 빌드·검증 이력은 커밋과 PR의 검사 결과를 기준으로 확인한다. 로컬의 모의 공개키로 만든 빌드는 배포용이 아니다.
- STEP 188에서 Node 22 전체 자동 테스트 140개, TypeScript·ESLint, Next.js 및 Netlify production 문맥 오프라인 빌드·Functions 번들링, 격리 PostgreSQL의 역할별 RLS 및 방문자 SQL 검사를 통과했다. 실제 Netlify·Supabase 통합 성공을 뜻하지 않는다.

## 1. 사전 준비와 PR 병합

학회 계정이 PR #1의 변경·CI를 검토하고 실제 배포 및 DB 미변경 상태를 확인한다. 기존 Netlify Git 빌드가 켜져 있으면 `main` 병합이 기존 Production 배포를 유발할 수 있다. 학회가 이를 승인하고 적절한 중지 시점을 결정하기 전에는 병합하지 않는다. 기존 배포의 정상 SHA와 Netlify Deploy ID를 기록한다. PR은 학회가 직접 병합하며 강제 push나 이력 재작성은 하지 않는다.

병합 후 Demo 저장소에서 `git switch main`, `git pull --ff-only`로 학회가 승인한 main을 가져온다. 원격 주소가 `https://github.com/koreaoaz/oaz-web-demo.git`인지 확인한다. 스크립트는 깨끗한 `main`과 원격 SHA 일치를 요구한다. 공식 저장소에서 실행하지 않는다.

## 2. Netlify 최초 인증과 연결

Node 22를 설치하고 Demo 폴더의 PowerShell에서 `npm ci --prefix tools/netlify`를 실행한다. 고정된 CLI로 `./tools/netlify/node_modules/.bin/netlify.cmd login`을 실행하고 브라우저에서 학회 Netlify 계정으로 인증한다. `./tools/netlify/node_modules/.bin/netlify.cmd link`로 **기존** `oneandzero-demo`를 선택한다. 새 사이트 생성은 선택하지 않는다. 개인 계정이나 다른 팀을 선택하지 않는다.

Netlify 프로젝트의 환경변수에 Demo 전용 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`를 Build 및 Functions에 설정한다. 값은 채팅·소스·로그에 남기지 않는다. `DEMO_VISITOR_SERVICE_KEY`와 `DEMO_VISITOR_HMAC_KEY`를 등록하거나 변경하지 않는다. 이미 존재하면 학회 관리자가 별도 승인 후 비활성화 여부를 확인한다. OAuth에는 실제 사이트와 Draft 리다이렉트가 허용되어야 한다.

## 3. 검증과 Draft

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`은 연결된 사이트 이름·주소, Node 22, 깨끗한 main, 원격 SHA를 확인하고 `npm ci`, 타입·lint·전체 테스트, Netlify production 문맥 빌드를 실행한다. 인증 정보를 GitHub Secret에 넣지 않는다. 오류가 발생하면 배포하지 않는다.

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1`은 위 검증을 다시 실행한 뒤 표시된 전체 SHA를 직접 입력받아 동일 산출물을 Draft로 배포한다. 호출 자체를 자동 승인으로 취급하지 않는다. 공개될 수 있는 Draft에는 가짜 데이터만 사용한다. Netlify Deploys에서 SHA와 Draft 주소를 확인한다. SSR 페이지, API Route, Demo Supabase 연결, GitHub OAuth, 공개 이미지·Storage, Editor CRUD 및 Excel을 점검한다. 방문자 API는 503이어야 한다.

## 4. 역할별 실환경 보안 검사

사용자 승인 후 익명, 미승인 GitHub 사용자, 승인된 일반 회원, Demo 관리자를 각각 분리한다. 테스트 행·이미지는 Demo 전용 가짜 데이터만 사용하고, 성공한 예상 밖 변경은 즉시 중단해 확인한다. 토큰·JWT·이메일·UUID·응답 원문을 출력·공유하지 않는다.

관리자가 생성한 가짜 행의 ID와 가짜 Storage 경로에만 다음을 수행한다. 일반 회원과 익명의 공지·프로젝트·스터디·행사 INSERT는 거부되어야 하며, UPDATE/DELETE는 응답 코드뿐 아니라 반환 행 0개와 관리자 재조회 결과로 변경 없음을 확인한다. 동일하게 `allowed_user` 변경, `supervisor_id` 변경, 본인 `is_manager` 상승, 가짜 타 회원 정보 조회 및 고유 경로의 Storage 업로드·교체·삭제를 검사한다. 공개 게시글과 이미지는 익명이 읽을 수 있어야 하고 관리자만 Editor에 접근해 CRUD를 성공해야 한다. 고유 이미지 경로에는 덮어쓰기 없이 테스트하고 끝난 후 정확히 생성한 가짜 객체만 관리자가 삭제한다.

실제 API의 단계별 URL, GET/PATCH/DELETE와 Storage 방법은 기존 `MILESTONE_C_ROLE_TEST_GUIDE.md`를 따른다. 읽기 전용 정책 검사 SQL은 `database/demo_security_inspect.sql`이며, 실행 전 SQL Editor의 Demo 프로젝트 식별자를 사용자가 확인한다. 정책 수만으로 보안을 판정하지 않는다. 가짜 일반 회원으로 우회에 성공하거나 타인 정보가 보이면 즉시 중단한다.

## 5. Production 및 복구

동일 SHA의 Draft와 역할별 검사를 통과한 뒤 학회가 별도 승인한 경우에만 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1 -Production`을 실행한다. 스크립트는 재검증·재빌드 후 전체 SHA 입력을 요구한다. Netlify Deploys의 대상 사이트·메시지 SHA·상태를 확인하고 실제 페이지와 API를 다시 확인한다. 이 입력은 학회의 Draft 검증을 기술적으로 증명하지 않으므로 학회가 결과를 따로 기록해야 한다.

배포 실패 또는 회귀 시 Netlify **Deploys → 이전 정상 배포 → Publish deploy**로 승인된 이전 배포를 복원하고 SHA와 동작을 확인한다. Git 자동 배포가 켜져 있으면 이후 push가 복구 상태를 다시 덮을 수 있다. CLI Draft 성공과 학회 승인 이후에만 **Project configuration → Developer settings → Continuous deployment → Build settings → Configure → Build status → Stopped builds**로 Git 빌드를 중지한다. 이 설정은 Netlify의 모든 Git 기반 빌드도 중지한다. CLI 수동 배포는 별도다.

## 사용자가 직접 할 일

1. PR과 기존 Git 자동 배포의 영향 검토 및 병합 승인.
2. 학회 Netlify 로그인·기존 사이트 연결과 Demo 공개 환경변수 확인.
3. 검증 스크립트 실행과 Draft 승인, 실제 OAuth·일반 회원·관리자 보안 테스트.
4. 결과 기록 후 별도의 Production 승인 및 배포 SHA 확인.
5. 필요 시 승인된 Git 빌드 중지 또는 이전 배포 복원.
