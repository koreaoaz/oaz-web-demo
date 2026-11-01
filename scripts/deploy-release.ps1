param([switch]$Production)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
& (Join-Path $PSScriptRoot 'verify-release.ps1')
$sha = (git rev-parse HEAD).Trim()
$cli = Join-Path $root 'tools/netlify/node_modules/.bin/netlify.cmd'
$raw = & $cli status --json 2>$null
if ($LASTEXITCODE -ne 0) { throw '사이트 확인 실패' }
$status = ($raw -join "`n") | ConvertFrom-Json
if (-not $status.linked -or $status.siteData.'site-name' -ne 'oneandzero-demo' -or $status.siteData.'site-url' -ne 'https://oneandzero-demo.netlify.app' -or $status.siteData.'site-id' -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Demo 사이트가 아닙니다.' }
$id = $status.siteData.'site-id'
function Assert-ApprovedCommit {
  if ((git branch --show-current) -ne 'main' -or (git rev-parse HEAD).Trim() -ne $sha -or (git status --porcelain)) { throw '검증 이후 작업 트리가 변경됐습니다.' }
  $remote = git ls-remote origin refs/heads/main
  if ($LASTEXITCODE -ne 0 -or ($remote -split '\s+')[0] -ne $sha) { throw '원격 main이 변경됐습니다.' }
}
if ($Production) {
  Write-Host '같은 커밋의 Draft에서 SSR, API, OAuth, 이미지와 권한 검증을 완료했는지 확인하세요.'
  if ((Read-Host 'Production 배포를 승인하려면 전체 커밋 SHA를 입력하세요') -cne $sha) { throw 'Production 승인이 없어 중단했습니다.' }
  Assert-ApprovedCommit
  & $cli deploy --no-build --context production --site $id --prod --message "Demo production $sha"
} else {
  if ((Read-Host 'Draft 배포를 승인하려면 전체 커밋 SHA를 입력하세요') -cne $sha) { throw 'Draft 승인이 없어 중단했습니다.' }
  Assert-ApprovedCommit
  & $cli deploy --no-build --context production --site $id --message "Demo draft $sha"
}
if ($LASTEXITCODE -ne 0) { throw '배포가 실패했습니다.' }
Write-Host "Netlify Deploys에서 사이트와 배포 커밋을 확인하세요: $sha"
