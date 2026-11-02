# 학생용 Demo 개발 시작 안내

이 저장소는 학회 공식 사이트와 별도의 **Demo**다. 기존 `[DEMO TEST]` 게시물·이미지는 예시로 보존한다. 실제 일반 회원의 직접 API 및 Storage 권한 검증은 아직 끝나지 않았다. 운영 Supabase 키, 실제 회원 데이터, 비밀번호와 서버 비밀키는 사용하지 않는다.

## 1. 준비와 초대

각자 개인 GitHub 계정을 쓴다. 관리자가 Demo 저장소에 초대하면 GitHub 알림 또는 이메일의 초대를 확인하고 수락한다. 이 문서는 초대하거나 권한을 변경하지 않는다. Git, Node.js 안정 버전 **22.13.0 이상 23 미만**, npm, VS Code, Chrome 또는 Edge를 설치한다. 이 프로젝트의 `package.json`과 Netlify CLI가 같은 Node 범위를 요구한다.

PowerShell에서 다음을 확인한다. `node`가 24나 20이면 먼저 각자 설치한 Node 버전 관리 도구로 22를 선택한다. 특정 다른 사람의 PC 경로를 복사하지 않는다.

```powershell
git --version
node --version
npm --version
```

## 2. 복제와 공개 환경변수

작업할 폴더에서 실행한다. 개인 폴더 이름은 각자 정한다.

```powershell
git clone https://github.com/koreaoaz/oaz-web-demo.git
Set-Location .\oaz-web-demo
git remote -v
npm ci
Copy-Item .env.example .env.local -NoClobber
code .env.local
```

초대가 아직 수락되지 않았거나 로그인 계정이 다르면 clone이 404 또는 인증 오류를 낼 수 있다. GitHub 웹에서 Demo 저장소 접근 여부를 먼저 확인하고, 비밀번호나 토큰을 채팅에 보내지 않는다. `npm ci` 오류가 나면 Node 22와 lockfile을 확인한다. lockfile을 임의로 고치거나 `npm audit fix`로 우회하지 않는다.

`.env.local`에는 예시의 `NEXT_PUBLIC_SUPABASE_URL`과 **Demo의 공개 publishable/anon 키**인 `NEXT_PUBLIC_SUPABASE_KEY`만 입력한다. 공개 키는 브라우저에 포함되는 값이다. Dashboard에서 Demo ref `ctbwaqtqubmjmltbxfzm`에 속한 키인지 관리자와 확인한다. `service_role`, `sb_secret_`, DB 비밀번호, OAuth Client Secret은 받거나 입력하지 않는다. `.env.local`을 커밋하거나 스크린샷으로 공유하지 않는다. 값은 이 문서에 적지 않는다.

## 3. 브랜치에서 개발

```powershell
git status -sb
git switch main
git pull --ff-only origin main
git switch -c feature/my-change
npm run dev
```

기존 미커밋 작업이 있으면 먼저 보존하고, `git switch`가 실패하면 출력된 충돌 파일을 확인한다. 강제 초기화는 하지 않는다. 서버가 안내하는 로컬 주소를 브라우저에서 연다. 로그인·편집은 **실제 Demo DB**에 영향을 줄 수 있으므로 승인된 가짜 계정과 가짜 데이터만 사용한다. 기존 예시 데이터는 삭제하지 않는다. 종료는 실행 중인 터미널에서 `Ctrl+C`다.

## 4. 순차 검증

```powershell
npx tsc --noEmit
npm run lint
node --test --test-concurrency=1 'tests/*.test.mjs'
git diff --check
git status -sb
```

의존성 설치나 무거운 빌드를 동시에 여러 개 실행하지 않는다. 브라우저·PostgreSQL 관련 테스트가 도구 부족으로 건너뛰면 결과를 통과로 적지 않는다. 변경 사항에서 환경파일이나 개인정보가 포함되지 않았는지 확인한다. 다음은 [GitHub 협업 안내](GITHUB_COLLABORATION_GUIDE.md)다.

위 명령은 이 저장소의 설정에 근거한 안내다. 다른 컴퓨터에서의 설치·로그인 성공은 각자 확인해야 한다.
