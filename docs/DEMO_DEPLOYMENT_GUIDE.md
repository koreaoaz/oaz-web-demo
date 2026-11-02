# Demo Draft·Production 배포

이 문서는 `DEMO_FINAL_RELEASE_RUNBOOK.md`와 `scripts/release-lib.ps1`을 참고한 학생용 안내다. Netlify Git 빌드는 사용자 확인상 **Stopped builds**이고, 자동 배포를 켜거나 연결을 다시 설정하지 않는다. 팀원 추가가 제한된 현재 환경에서는 친구 전원이 독립적으로 원격 배포할 수 있다고 보장할 수 없다. Owner 계정이나 토큰을 공유하지 않는다.

## 현재 가능한 경로

친구는 feature 브랜치에서 로컬로 수정하고 PR·CI·리뷰를 진행한다. 현재 릴리스 스크립트는 **깨끗한 main과 실제 origin/main SHA 일치**를 요구하므로 feature 브랜치에서 실행해 Draft를 만드는 방식은 지원하지 않는다. 병합 전 원격 Preview가 필요하다면 별도 Demo 전용 Preview 사이트, 별도 계정·DB 및 제한된 배포 권한을 설계해야 한다. 사이트를 임의 생성하거나 기존 보호를 완화하지 않는다.

현 단계의 기본 방식은 지정된 담당자가 검토된 PR을 병합한 후, GitHub 검사 결과와 SHA를 직접 확인하고 **기존 Demo 사이트**에 Draft를 만드는 것이다. 친구는 Draft를 검토하고 담당자는 승인된 뒤 별도로 Production을 배포한다. Netlify의 사이트 권한이 Production까지 허용한다면 CLI 스크립트의 승인 프롬프트만으로 권한을 강제할 수 없다. 권한·2FA는 사용자가 별도 결정한다.

## 담당자의 확인과 명령

Demo 프로젝트 폴더에서 PowerShell을 열고 Node 22를 선택한 후 아래를 실행한다. 각자의 Node 설치 경로는 다를 수 있다. `git status`에 미커밋 작업이 있으면 보존하고 먼저 확인한다.

```powershell
node --version
git status -sb
git remote -v
git switch main
git pull --ff-only origin main
git rev-parse HEAD
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1
```

검증은 Node 버전, Demo Git fetch/push 원격, 깨끗한 main 및 실제 원격 SHA, 사이트 이름·ID·URL, Demo 공개 환경변수, 타입·lint·테스트, Netlify 빌드와 정적 파일·서버 함수 ZIP 존재를 확인한다. 정확한 main SHA의 push CI와 필수 작업 성공을 승인 전후 확인하며 인증·조회 실패와 CI 미완료·실패·누락 시 차단한다. 실제 SSR 요청 성공까지 자동으로 보장하지 않는다. 자격증명 원문을 출력하지 않는다.

**Draft를 배포하기로 승인받은 후에만** 아래를 실행하고, 검증 완료 후 GitHub main과 일치하는 전체 SHA를 직접 입력한다. `-Production`을 붙이지 않는다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1
```

스크립트는 다시 검증하고 승인 직후 사이트·SHA·환경·정적 파일을 재확인한다. Netlify Deploys에서 Draft URL과 커밋을 확인하고 HTML·CSS·JS, 레이아웃, SSR/API, Demo OAuth·이미지 및 권한을 확인한다. 기존 CSS 404가 수정된 새 Draft의 레이아웃은 사용자가 정상이라고 보고했으며, 사용자별 보안 검사는 아직 미완료다.

Production은 Draft 검증, 일반 회원을 포함한 실환경 API·Storage 권한 검증과 별도의 명시적 승인 후 담당자가 다음 명령과 **새 전체 SHA 확인**으로 실행한다. 일반 회원 권한 검증은 현재 미완료다. 이 명령은 실제 사이트에 영향을 준다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1 -Production
```

잘못된 Node·사이트·원격·작업 트리·환경변수 또는 SHA 오류가 나면 수정 전 원인을 확인한다. Git Credential Manager의 GitHub 읽기 인증과 해당 main SHA의 push CI를 GitHub 화면에서도 확인한다. 새 병합 커밋은 CI가 끝나기 전까지 배포할 수 없다. 배포 결과가 실패했다면 이전 성공 배포의 SHA를 확인하고, 승인된 담당자가 Netlify **Deploys → 이전 성공 배포 → Publish deploy**로 되돌린 뒤 화면과 SHA를 검증한다. 이는 실제 Production 변경이다. 배포·복원 명령은 이 문서 작성 중 실행하지 않았다.
