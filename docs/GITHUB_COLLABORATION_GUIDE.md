# GitHub 협업과 리뷰

Demo 저장소는 `koreaoaz/oaz-web-demo`다. 공식 `koreaoaz/oazkorea_web`에는 push하지 않는다. `koreaoaz`는 현재 개인 계정이며, Private 개인 저장소 협업자는 쓰기와 PR 병합 능력이 있다. 사용자 확인상 현재 이 Private 개인 저장소의 Ruleset은 계정 유형 제한으로 강제 적용되지 않는다. 따라서 아래 PR 절차는 **자율 운영 규칙**이며 서버가 main 직접 push, 강제 push, CI 실패 병합이나 워크플로 변경을 막는다고 보장하지 않는다. 소유자가 적용 가능한 브랜치 보호·플랜을 확인하기 전에는 강제 통제로 간주하지 않는다.

## 개발 브랜치와 PR

개발과 검증을 마친 뒤 PowerShell에서 변경 내용을 읽고, 본인 작업만 선택한다. 다른 사람의 파일이나 `.env.local`은 포함하지 않는다. `git add -p`는 추적 중인 파일의 변경 조각을 대화식으로 고른다. **새 파일은 자동 선택하지 않으므로 커밋 전에** 실제 파일 경로를 `git add --` 뒤에 지정한다. 예를 들어 새 파일이 실제로 `src\app\sample\page.tsx`에 있다면 `git add -- .\src\app\sample\page.tsx`를 실행한다. 이 경로는 설명용 예시다.

```powershell
git status -sb
git diff --check
git diff
git add -p
git diff --cached
git commit -m "변경 내용 요약"
git push -u origin feature/my-change
```

GitHub의 Demo 저장소 **Pull requests → New pull request**에서 base가 `main`, compare가 본인 브랜치인지 확인한다. 변경 내용, 테스트·미검증 사항과 사용한 가짜 데이터만 적는다. **Checks**의 Windows 회귀·빌드와 PostgreSQL 보안 작업 결과를 확인한다. 실패·취소·대기는 통과가 아니다. Secrets, DB 비밀번호, 회원정보와 토큰을 첨부하지 않는다.

## 리뷰와 병합

친구끼리 서로 리뷰하되 초기에는 담당 관리자도 권한·DB·배포 영향과 비밀정보를 확인한다. 작성자가 자기 PR을 승인한 것으로 취급하지 않는다. 리뷰어는 코드뿐 아니라 `.github/workflows`, `scripts`, `database`, 환경변수 변경을 확인한다. 새 코드가 공식 서비스에 접근하거나 비밀값을 외부로 전송할 수 있으므로 출처 불명 PR을 신뢰된 비밀값이 있는 환경에서 실행하지 않는다.

승인·CI 성공 후 지정된 담당자가 PR의 최종 SHA와 base를 재확인하고 GitHub에서 병합한다. 다른 사람이 변경하면 새 커밋과 CI를 다시 확인한다. main 직접 push나 force push는 하지 않는다는 팀 합의를 지킨다. 병합 권한이 기술적으로 제한되지 않을 수 있다. 관리자 직접 승인 방식은 통제가 쉽고 병목이 있고, 상호 리뷰는 학습·지속성에 유리하지만 승인 범위가 넓어진다. 보호 수단이 확보되기 전에는 상호 리뷰 **및 담당 관리자 확인**을 권장한다.

## CI와 병합 SHA의 차이

현재 CI는 `pull_request`와 수동 실행에서 동작하며, PR의 head 또는 GitHub가 만든 병합 검사 SHA를 검사할 수 있다. main 병합 커밋과 같은 SHA라고 가정하지 않는다. 현재 릴리스 스크립트는 로컬 테스트와 원격 main SHA는 확인하지만 **GitHub CI 성공을 조회하지 않는다**. `Checks`에서 검사 SHA·최신 base·결과를 담당자가 직접 비교한다.

추후 개선안: `push: main`의 토큰 없는 CI가 **병합된 정확한 SHA**에 고유한 필수 작업 결과를 남기도록 설계하고, 릴리스 도구가 지정 저장소·정확한 SHA·신뢰한 workflow/job·완료 성공을 검증한다. 결과가 없거나 실패·취소·대기·조회 불가면 안전하게 거부해야 한다. 재실행, 중복 이름, 페이지네이션, workflow 자체 변경, PR 가상 병합 SHA와 main SHA의 차이를 테스트한 뒤 도입한다. 현재 저장소에서 ruleset이 강제되지 않으면 협업자가 workflow와 검사 코드를 변경할 수 있으므로, 이 검사만으로 악의적 변경을 막을 수 없다. 실제 코드는 이번 문서 작업에서 변경하지 않았다.
