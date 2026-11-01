# Demo GitHub 검토 및 Netlify 배포 절차

## 권장 흐름

1. `origin`의 fetch·push URL이 Demo 저장소인지 확인하고 `origin/main`을 읽기 전용으로 갱신한다. 로컬 변경사항을 보존한 상태에서 최신 main을 바탕으로 별도 개발 브랜치를 만든다. 이미 진행한 미커밋 작업은 확인 없이 버리지 않는다.
2. 변경 범위·비밀정보를 검토하고 `npm run lint`, `npx tsc --noEmit`, `node --test --test-concurrency=1 tests/*.test.mjs`, 필요한 로컬 PostgreSQL 검사, Demo 설정만 사용한 빌드를 수행한다. 실제 서버 키는 Git에 넣지 않는다.
3. 승인된 개발 브랜치만 Demo 원격에 push하고 PR의 base가 Demo `main`인지 확인한다. PR 및 브랜치 push도 Netlify Deploy Preview나 브랜치 배포를 자동으로 유발할 수 있다. 원치 않는 원격 배포를 막으려면 미리 Netlify의 해당 자동 빌드·승인 정책을 확인하고 사용자 승인을 받는다.
4. 학회 계정 `koreaoaz`가 코드·검사·보안 위험을 검토한다. 관리자가 GitHub UI에서 일반 merge commit을 선택하는 방법을 우선 시험한다. merge commit은 기여자의 원래 커밋들을 보존하며 병합 커밋이 추가된다. squash는 단일 커밋으로 합치고, rebase는 각 커밋의 SHA와 committer를 바꾼다. Git 작성자·committer를 수동 위조하지 않는다.
5. 학회 계정이 실제 병합하기 전 배포 승인 여부를 확인한다. 병합 뒤 GitHub main의 SHA 및 해당 커밋의 author와 committer를 살펴보고, Netlify Deploys에서 **같은 SHA**의 빌드가 실행·게시됐는지 확인한다. 학회 계정의 병합만으로 Netlify가 반드시 해당 작성자를 인정한다고 가정하지 않는다. pending approval이나 차단이면 게시 성공으로 표시하지 않는다.
6. 보호된 Demo URL에서 사용자 승인 범위 내에 기능을 검증하고, 배포 실패 시 Netlify에서 이전 정상 배포로 되돌리는 절차를 검토한다. 이 작업은 자동 실행하지 않는다.

## 인정되지 않는 Git 기여자 대안

- Netlify 팀 Owner가 해당 배포 요청을 수동 승인하거나 `Larry826`을 Git Contributor로 연결할 수 있다. 팀 요금·권한과 자동 승인 범위는 설정 화면에서 확인한다. 자동 승인은 선택사항이다.
- Netlify CLI의 `netlify build`와 draft `netlify deploy`는 별도 인증·권한과 승인된 환경이 필요하다. `netlify deploy --prod`는 실제 게시이므로 별도 승인 후에만 실행한다. Next.js SSR/Route Handler 출력과 Netlify 어댑터를 검증해야 하며 `.next`만 임의 업로드하는 방식은 가정하지 않는다.
- build hook은 기여자 승인 정책의 영향을 받지 않는 신뢰된 트리거다. URL은 사실상 비밀 권한이므로 노출·무분별한 사용을 피하고 명시적 승인과 접근 통제 없이는 사용하지 않는다.

근거: [Netlify 배포 요청 정책](https://docs.netlify.com/deploy/deploy-overview/), [GitHub 병합 방식](https://docs.github.com/en/pull-requests/reference/pull-request-merges), [Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/). 실제 팀 요금제와 Netlify의 작성자 매칭은 이 작업에서 확인하지 않았다.
