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

학회 계정이 PR #1의 변경·CI를 검토하고 실제 배포 및 DB 미변경 상태를 확인한다. 사용자 확인에 따르면 현재 Netlify Git 빌드는 **Stopped builds**다. 이 상태와 Git 연결을 유지한다. Git 빌드가 다시 켜지면 `main` 병합이 Production 배포를 유발할 수 있으므로 먼저 확인한다. 기존 배포의 정상 SHA와 Netlify Deploy ID를 기록한다. PR은 학회가 직접 병합하며 강제 push나 이력 재작성은 하지 않는다.

병합 후 Demo 저장소에서 `git switch main`, `git pull --ff-only`로 학회가 승인한 main을 가져온다. 원격 주소가 `https://github.com/koreaoaz/oaz-web-demo.git`인지 확인한다. 스크립트는 깨끗한 `main`과 원격 SHA 일치를 요구한다. 공식 저장소에서 실행하지 않는다.

## 2. Netlify 최초 인증과 연결

안정 Node **22.13.0 이상, 23 미만**을 설치하고 Demo 폴더의 PowerShell에서 `npm ci --prefix tools/netlify`를 실행한다. Node 20·23·24 및 prerelease는 지원 범위 밖이다. package.json과 두 lockfile의 루트 engines가 같은 범위를 선언한다. CLI는 27.16.1로 고정하며 최소 22.13.0이 필요하다. GitHub Actions와 Netlify의 `22` 설정은 이 범위의 최신 안정 22를 선택한다. 고정된 CLI로 `./tools/netlify/node_modules/.bin/netlify.cmd login`을 실행하고 브라우저에서 학회 Netlify 계정으로 인증한다. `./tools/netlify/node_modules/.bin/netlify.cmd link`로 **기존** `oneandzero-demo`를 선택한다. 새 사이트 생성은 선택하지 않는다. 개인 계정이나 다른 팀을 선택하지 않는다.

Netlify 프로젝트의 환경변수에 Demo 전용 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`를 Build 및 Functions에 설정한다. 값은 채팅·소스·로그에 남기지 않는다. `DEMO_VISITOR_SERVICE_KEY`와 `DEMO_VISITOR_HMAC_KEY`를 등록하거나 변경하지 않는다. 이미 존재하면 학회 관리자가 별도 승인 후 비활성화 여부를 확인한다. OAuth에는 실제 사이트와 Draft 리다이렉트가 허용되어야 한다.

## 3. 검증과 Draft

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`은 연결된 사이트 이름·주소·UUID, Node 범위, 저장소 루트, fetch/push 원격, 깨끗한 main, 실제 원격 main SHA를 확인하고 `npm ci`, 타입·lint·전체 테스트, Netlify production 문맥 빌드를 실행한다. `pwsh -NoProfile -File .\scripts\verify-release.ps1`도 지원한다. 모든 PS1의 UTF-8 BOM을 유지한다(Windows PowerShell 5.1의 한글 해석에 필요). CRLF와 LF 모두 회귀 검사한다. 인증 정보를 GitHub Secret에 넣지 않는다. 오류가 발생하면 배포하지 않는다.

스크립트는 연결된 사이트의 공개 환경변수 두 개만 `env:get --json`으로 메모리에 읽으며 값을 표시하거나 저장하지 않는다. production의 builds/functions 양쪽 값이 일치하고 Demo URL 및 공개키 형식인지 검사한다. 로컬 환경변수와 충돌하거나 값이 없으면 중단한다. process 환경변수는 빌드 후 원복한다. `NETLIFY_AUTH_TOKEN`/`NETLIFY_SITE_ID` 환경변수로 대상이나 인증을 덮어쓰는 실행은 거부한다. CLI 로컬 로그인과 기존 사이트 link를 사용한다. 모의 키로 만든 오프라인 산출물을 그대로 배포하지 말고 이 재빌드 경로를 사용한다.

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1`은 위 검증을 다시 실행한 뒤 표시된 전체 SHA를 직접 입력받아 동일 산출물을 Draft로 배포한다. 호출 자체를 자동 승인으로 취급하지 않는다. 공개될 수 있는 Draft에는 가짜 데이터만 사용한다. Netlify Deploys에서 SHA와 Draft 주소를 확인한다. SSR 페이지, API Route, Demo Supabase 연결, GitHub OAuth, 공개 이미지·Storage, Editor CRUD 및 Excel을 점검한다. 방문자 API는 503이어야 한다.

## 4. 역할별 실환경 보안 검사

사용자 승인 후 익명, 미승인 GitHub 사용자, 승인된 일반 회원, Demo 관리자를 각각 분리한다. 테스트 행·이미지는 Demo 전용 가짜 데이터만 사용하고, 성공한 예상 밖 변경은 즉시 중단해 확인한다. 토큰·JWT·이메일·UUID·응답 원문을 출력·공유하지 않는다.

관리자가 생성한 가짜 행의 ID와 가짜 Storage 경로에만 다음을 수행한다. 일반 회원과 익명의 공지·프로젝트·스터디·행사 INSERT는 거부되어야 하며, UPDATE/DELETE는 응답 코드뿐 아니라 반환 행 0개와 관리자 재조회 결과로 변경 없음을 확인한다. 동일하게 `allowed_user` 변경, `supervisor_id` 변경, 본인 `is_manager` 상승, 가짜 타 회원 정보 조회 및 고유 경로의 Storage 업로드·교체·삭제를 검사한다. 공개 게시글과 이미지는 익명이 읽을 수 있어야 하고 관리자만 Editor에 접근해 CRUD를 성공해야 한다. 고유 이미지 경로에는 덮어쓰기 없이 테스트하고 끝난 후 정확히 생성한 가짜 객체만 관리자가 삭제한다.

실제 API의 단계별 URL, GET/PATCH/DELETE와 Storage 방법은 기존 `MILESTONE_C_ROLE_TEST_GUIDE.md`를 따른다. 읽기 전용 정책 검사 SQL은 `database/demo_security_inspect.sql`이며, 실행 전 SQL Editor의 Demo 프로젝트 식별자를 사용자가 확인한다. 정책 수만으로 보안을 판정하지 않는다. 가짜 일반 회원으로 우회에 성공하거나 타인 정보가 보이면 즉시 중단한다.

## 5. Production 및 복구

동일 SHA의 Draft와 역할별 검사를 통과한 뒤 학회가 별도 승인한 경우에만 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1 -Production`을 실행한다. 스크립트는 재검증·재빌드 후 전체 SHA 입력을 요구한다. Netlify Deploys의 대상 사이트·메시지 SHA·상태를 확인하고 실제 페이지와 API를 다시 확인한다. 이 입력은 학회의 Draft 검증을 기술적으로 증명하지 않으므로 학회가 결과를 따로 기록해야 한다.

배포 실패 시 스크립트는 성공을 표시하거나 자동 재시도하지 않는다. 실패 단계명과 종료 코드를 확인한다. 인증/환경변수 응답 원문을 로그에 복사하지 않는다. 미완성 배포를 승인하지 말고 사이트·산출물·SHA를 재검증한다. Production 회귀 시 Netlify **Deploys → 이전 정상 배포 → Publish deploy**로 학회가 승인한 이전 배포를 복원하고 SHA와 동작을 확인한다. Git 자동 배포가 켜져 있으면 이후 push가 복구 상태를 다시 덮을 수 있다. 현재 **Stopped builds**는 그대로 유지한다. 이 설정은 Git 기반 빌드를 중지하며 CLI 수동 배포는 별도다. 이번 수정에서는 배포나 설정 변경을 하지 않았다.

## 6. 배포하지 않는 로컬 회귀 검사

- `node --test --test-concurrency=1 tests/*.test.mjs`: 실제 PowerShell 5.1/7 프로세스에서 LF/CRLF 라이브러리와 한글 승인/취소 문구, Node 경계값, 잘못된 저장소·사이트·환경변수·SHA, 검증 실패 즉시 중단을 검사한다. 모든 배포/Git/네트워크 명령은 가짜 응답이며 실제 deploy 요청은 없다. Windows CI는 두 PowerShell의 존재를 필수 확인한다. 로컬에서 pwsh가 PATH에 없으면 `OAZ_TEST_PWSH`에 실행 파일 경로를 지정한다. 미설치로 skip한 엔진은 통과로 간주하지 않는다.
- `python tests/postgres-harness.test.py`: 설치 탐색, 명시 경로 오류, 미설치 구분, 외부 경로 정리 거부와 종료 후 삭제 순서를 서버 접속 없이 검사한다.
- `python tests/demo-role-db.test.py`, `python tests/visitor-db.test.py`: `OAZ_TEST_PG_BIN` → PATH/pg_config → OS 설치 경로 순으로 탐색한다. 임시 디렉터리·임의 loopback 포트·무작위 로컬 인증정보만 쓰며 PG 외부 접속 환경변수를 무시한다. 테스트 종료/실패 시 서버 종료를 확인하고 생성한 임시 데이터와 로그를 지운다. 종료 확인 실패 시 파일을 보존하고 실패한다. PostgreSQL 미설치는 명확한 **SKIP/종료 코드 77**, 잘못 지정한 경로나 실제 실패는 비정상 종료다. CI는 도구를 설치하므로 77도 실패 처리한다. Linux는 root가 아닌 사용자로 실행한다. Windows와 Linux CI에서 각각 실행한다.
- 격리 SQL 테스트는 가짜 auth/storage 테이블을 쓴다. 실제 Supabase 역할·Auth·Storage API 동작을 증명하지 않으며, 참고 SQL을 원격 DB에 적용하지 않는다. 방문자 기능은 통과 여부와 관계없이 BLOCKED다.

## 7. PR 검사와 이전 Netlify 실패의 구분

기준 커밋 `d07cc18c0875768b6c3188f40dc9bc888e6fe24b`의 GitHub Actions 회귀·빌드는 success다. Netlify Preview 및 Redirect rules / Header rules / Pages changed 실패 4건은 모두 Deploy ID `6ae6dd729b7f59699d3f150d`를 참조한다. 세 부가 검사는 같은 실패 배포 로그로 안내할 뿐이며 독립적인 규칙 오류 3건이 확인된 것은 아니다. 이번 API 읽기 시도로 상세 로그를 확보하지 못했으므로 **이번 배포의 정확한 실패 원인은 미확인**이다. 사용자가 이전 화면에서 확인한 `unrecognized Git contributor`를 이번 실패의 확정 원인으로 대체하지 않는다.

GitHub branch protection 조회는 404, rulesets 조회는 403으로 필수 검사 설정을 확정할 수 없다. 학회가 Settings → Branches / Rules → Rulesets에서 확인한다. 현재 사용하지 않는 Netlify Git Preview의 과거 실패와 GitHub CI 실패는 구분한다. CLI 수동 배포 경로의 코드 병합과 실제 Draft/Production 승인도 별도다. GitHub에서 Netlify 상태 검사가 필수로 지정돼 있다면 학회가 정책을 검토해야 하며, 이 작업에서 규칙을 우회하거나 변경하지 않는다. 최종 커밋의 CI 결과와 정확한 SHA는 PR에 기록한다.

### STEP 190-3 로컬 검증 결과

- Node 22.23.4에서 자동 테스트 **144/144**, 실패·skip 0. TypeScript와 ESLint 통과. PowerShell 5.1 및 7.6.9 실제 프로세스의 LF/CRLF, 한글, 승인/취소, Node 경계값과 가짜 CLI 안전 차단 검사 통과.
- Next.js 16.4.3 프로덕션 빌드, Netlify CLI 27.16.1의 production 문맥 **오프라인 빌드 및 SSR Functions 번들링** 통과. 모의 공개키만 사용했으므로 실제 배포 산출물로 승인하지 않는다.
- PostgreSQL 17.11의 새 임시 인스턴스에서 역할별 GRANT/RLS, 방문자 중복·동시 요청·상한·원복·재적용 검사 통과. 두 인스턴스 모두 종료 및 파일 정리 완료. 탐색/정리 단위 검사 5개도 통과. Linux 검사는 추가한 GitHub CI 작업의 결과로 별도 확인한다.
- 새 프로덕션 빌드로 loopback 서버를 실행해 홈페이지 200, 방문자 GET·정상 Origin POST 503, 교차 Origin POST 403을 확인했다. 설정 누락 및 운영 URL 입력 시 서버 실행 거부도 확인했다. 첫 검사에서 loopback 주소와 Origin을 다르게 준 403은 테스트 주소를 일치시켜 재검증했으며 API를 변경하지 않았다.
- actionlint, `git diff --check` 통과. Git 업로드 대상 비밀정보 패턴 검사에서 탐지 없음. 실행하지 못한 실제 OAuth·역할별 RLS·Storage 통합 및 Netlify Draft/Production은 완료로 표시하지 않는다.
- 로컬 기본 npm 런처는 시스템 Node 24를 사용해 최초 `npm ci`에서 engines 경고가 있었다. 설치는 성공했고, 이후 타입·lint·테스트·Next/Netlify 빌드는 Node 22 실행 파일과 PATH를 명시해 수행했다. 실제 릴리스에서는 지원 범위의 Node/npm 설치를 사용한다. CI도 Node 22에서 `npm ci`부터 실행한다. 개발/CLI 의존성의 기존 보통 등급 감사 항목은 위 현재 상태에 기록한 대로 남아 있다.

인코딩 근거: [Microsoft PowerShell 문자 인코딩](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1). Git 빌드 중지와 CLI 배포의 구분: [Netlify Stopped builds 문서](https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/).

## 사용자가 직접 할 일

1. PR과 기존 Git 자동 배포의 영향 검토 및 병합 승인.
2. 학회 Netlify 로그인·기존 사이트 연결과 Demo 공개 환경변수 확인.
3. 검증 스크립트 실행과 Draft 승인, 실제 OAuth·일반 회원·관리자 보안 테스트.
4. 결과 기록 후 별도의 Production 승인 및 배포 SHA 확인.
5. 기존 Git 빌드 중지 상태 유지, 필요 시 승인된 이전 배포 복원.
