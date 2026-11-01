Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw '검증 명령이 실패했습니다.' } }
if ((node -p 'process.versions.node.split(".")[0]') -ne '22') { throw 'Node.js 22가 필요합니다.' }
if ($env:NETLIFY_AUTH_TOKEN -or $env:NETLIFY_SITE_ID) { throw '환경변수로 지정된 Netlify 인증 및 사이트 지정은 사용하지 않습니다.' }
if ((git branch --show-current) -ne 'main') { throw '승인된 main 브랜치에서만 배포할 수 있습니다.' }
if (git status --porcelain) { throw 'Git 작업 트리가 깨끗해야 합니다.' }
if ((git remote get-url origin).Trim() -ne 'https://github.com/koreaoaz/oaz-web-demo.git') { throw 'Demo Git 원격이 아닙니다.' }
$sha = (git rev-parse HEAD).Trim(); Check-Exit
$remote = (git ls-remote origin refs/heads/main); Check-Exit
if (($remote -split '\s+')[0] -ne $sha) { throw '로컬 main이 원격 main과 일치하지 않습니다.' }
& npm.cmd ci --prefix tools/netlify; Check-Exit
$cli = Join-Path $root 'tools/netlify/node_modules/.bin/netlify.cmd'
$statusText = & $cli status --json 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Netlify 로그인과 기존 Demo 사이트 연결을 확인하세요.' }
try { $status = ($statusText -join "`n") | ConvertFrom-Json } catch { throw 'Netlify 사이트 상태를 확인할 수 없습니다.' }
if (-not $status.loggedIn -or -not $status.linked -or $status.siteData.'site-name' -ne 'oneandzero-demo' -or $status.siteData.'site-url' -ne 'https://oneandzero-demo.netlify.app' -or $status.siteData.'site-id' -notmatch '^[0-9a-fA-F-]{36}$') { throw '연결된 사이트가 Demo와 일치하지 않습니다.' }
Write-Host "검증 대상 커밋: $sha"
& npm.cmd ci; Check-Exit
& npx.cmd tsc --noEmit; Check-Exit
& npm.cmd run lint; Check-Exit
& node --test --test-concurrency=1 'tests/*.test.mjs'; Check-Exit
& $cli build --context production; Check-Exit
if ((git rev-parse HEAD).Trim() -ne $sha -or (git status --porcelain)) { throw '검증 중 소스가 변경됐습니다.' }
Write-Host '검증과 Netlify 빌드가 끝났습니다. 아직 배포하지 않았습니다.'
