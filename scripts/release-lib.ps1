Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

function Assert-DemoNodeVersion([string]$Version) {
  # 안정 SemVer만 허용. prerelease와 잘못된 숫자는 승인하지 않는다.
  if ($Version -notmatch '^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$') { throw 'Node.js 버전을 확인할 수 없습니다. 안정 버전 22.13.0 이상, 23 미만이 필요합니다.' }
  $major = 0L; $minor = 0L; $patch = 0L
  if (-not [long]::TryParse($Matches[1], [ref]$major) -or -not [long]::TryParse($Matches[2], [ref]$minor) -or -not [long]::TryParse($Matches[3], [ref]$patch) -or $major -ne 22 -or $minor -lt 13) { throw 'Node.js 안정 버전 22.13.0 이상, 23 미만이 필요합니다.' }
}

function Invoke-DemoCommand([string]$Command, [string[]]$Arguments, [string]$Label, [switch]$Capture) {
  # 인증 상태/환경변수 JSON과 실패 stderr를 콘솔이나 파일에 노출하지 않는다.
  try { $resolved = Get-Command -Name $Command -CommandType Application -ErrorAction Stop } catch { throw "$Label 실행에 실패했습니다. 명령 설치와 인증을 확인하세요." }
  $savedPreference = $ErrorActionPreference
  try { $ErrorActionPreference = 'Continue'; $lines = @(& $resolved.Source @Arguments 2>&1); $code = $LASTEXITCODE } catch { throw "$Label 실행에 실패했습니다. 명령 설치와 인증을 확인하세요." } finally { $ErrorActionPreference = $savedPreference }
  if ($code -ne 0) { throw "$Label 검사에 실패했습니다. 종료 코드: $code" }
  if ($Capture) { return ($lines -join "`n").Trim() }
  Write-Host "$Label 완료"
}

function Get-DemoGitState([string]$Root) {
  $top = Invoke-DemoCommand git @('rev-parse','--show-toplevel') 'Git 루트' -Capture
  if ([IO.Path]::GetFullPath($top).TrimEnd('\','/') -ne [IO.Path]::GetFullPath($Root).TrimEnd('\','/')) { throw 'Demo 저장소 루트가 아닙니다.' }
  if ((Invoke-DemoCommand git @('branch','--show-current') 'Git 브랜치' -Capture) -cne 'main') { throw '승인된 main 브랜치에서만 배포할 수 있습니다.' }
  if (Invoke-DemoCommand git @('status','--porcelain') 'Git 상태' -Capture) { throw 'Git 작업 트리가 깨끗해야 합니다.' }
  foreach ($argsList in @(@('remote','get-url','origin'), @('remote','get-url','--push','origin'))) {
    if ((Invoke-DemoCommand git $argsList 'Git 원격' -Capture) -cne 'https://github.com/koreaoaz/oaz-web-demo.git') { throw 'Demo Git 원격이 아닙니다.' }
  }
  $sha = Invoke-DemoCommand git @('rev-parse','HEAD') 'Git 커밋' -Capture
  $remote = Invoke-DemoCommand git @('ls-remote','--exit-code','origin','refs/heads/main') '원격 main' -Capture
  if ($sha -cnotmatch '^[0-9a-f]{40}$' -or $remote -cnotmatch ('^' + $sha + '\s+refs/heads/main$')) { throw '로컬 main과 원격 main이 일치하지 않습니다.' }
  return $sha
}

function Get-DemoSite([string]$Cli) {
  try { $status = (Invoke-DemoCommand $Cli @('status','--json') 'Netlify 사이트' -Capture) | ConvertFrom-Json
    $id = [string]$status.siteData.'site-id'
    if (-not $status.loggedIn -or -not $status.linked -or $status.siteData.'site-name' -cne 'oneandzero-demo' -or $status.siteData.'site-url' -cne 'https://oneandzero-demo.netlify.app' -or $id -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { throw 'invalid' }
  } catch { throw 'Netlify 로그인 및 기존 oneandzero-demo 사이트 연결을 확인하세요.' }
  return $id
}

function Assert-DemoPublicKey([string]$Key) {
  if ($Key -cmatch '^sb_publishable_[A-Za-z0-9_-]+$') { return }
  try {
    $parts = $Key.Split('.')
    if ($parts.Count -ne 3) { throw 'invalid' }
    $payload = $parts[1].Replace('-','+').Replace('_','/')
    $payload = $payload.PadRight($payload.Length + ((4 - $payload.Length % 4) % 4), '=')
    $claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
    if ($claims.role -cne 'anon' -or $claims.ref -cne 'ctbwaqtqubmjmltbxfzm') { throw 'invalid' }
  } catch { throw 'Demo 공개용 publishable/anon 키가 필요합니다. 비밀키는 사용할 수 없습니다.' }
}

function Get-DemoBuildEnvironment([string]$Cli) {
  $values = @{}
  foreach ($scope in @('builds','functions')) {
    foreach ($name in @('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_KEY')) {
      try { $item = (Invoke-DemoCommand $Cli @('env:get',$name,'--context','production','--scope',$scope,'--json') 'Demo 환경변수' -Capture) | ConvertFrom-Json; $value = [string]$item.$name } catch { throw 'Netlify production의 builds/functions 공개 환경변수를 확인하세요.' }
      if (-not $value) { throw '필수 Demo 공개 환경변수가 없습니다.' }
      if ($name -eq 'NEXT_PUBLIC_SUPABASE_URL' -and $value -cne 'https://ctbwaqtqubmjmltbxfzm.supabase.co') { throw 'Demo Supabase URL이 아닙니다.' }
      if ($name -eq 'NEXT_PUBLIC_SUPABASE_KEY') { Assert-DemoPublicKey $value }
      if ($values.ContainsKey($name) -and $values[$name] -cne $value) { throw '빌드와 Functions의 Demo 환경변수가 다릅니다.' }
      $inherited = [Environment]::GetEnvironmentVariable($name,'Process')
      if ($inherited -and $inherited -cne $value) { throw '로컬 환경변수가 Netlify 설정과 다릅니다.' }
      $values[$name] = $value
    }
  }
  return $values
}

function Invoke-DemoVerification([string]$Root) {
  Push-Location -LiteralPath $Root
  try {
    Assert-DemoNodeVersion (Invoke-DemoCommand node @('--version') 'Node.js' -Capture)
    if ($env:NETLIFY_AUTH_TOKEN -or $env:NETLIFY_SITE_ID) { throw '환경변수로 지정된 Netlify 인증 및 사이트 지정은 사용하지 않습니다.' }
    $sha = Get-DemoGitState $Root
    Invoke-DemoCommand npm.cmd @('ci','--prefix','tools/netlify') '고정 Netlify CLI 설치'
    $cli = Join-Path $Root 'tools/netlify/node_modules/.bin/netlify.cmd'
    $id = Get-DemoSite $cli
    $values = Get-DemoBuildEnvironment $cli
    $saved = @{}
    try {
      foreach ($name in $values.Keys) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process'); [Environment]::SetEnvironmentVariable($name,$values[$name],'Process') }
      Invoke-DemoCommand npm.cmd @('ci') '의존성 설치'
      Invoke-DemoCommand npx.cmd @('tsc','--noEmit') 'TypeScript'
      Invoke-DemoCommand npm.cmd @('run','lint') 'ESLint'
      Invoke-DemoCommand node @('--test','--test-concurrency=1','tests/*.test.mjs') '전체 회귀 테스트'
      Invoke-DemoCommand $cli @('build','--context','production') 'Netlify SSR 및 Functions 빌드'
    } finally { foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') } }
    if ((Get-DemoGitState $Root) -cne $sha -or (Get-DemoSite $cli) -cne $id) { throw '검증 중 커밋 또는 사이트가 변경됐습니다.' }
    $null = Get-DemoBuildEnvironment $cli
    Write-Host "검증 완료 커밋: $sha. 아직 배포하지 않았습니다."
    return [pscustomobject]@{ Sha = $sha; SiteId = $id; Cli = $cli }
  } finally { Pop-Location }
}

function Get-DemoApprovalMessage([bool]$Production) {
  if ($Production) { return 'Production 배포를 승인하려면 전체 커밋 SHA를 입력하세요' }
  return 'Draft 배포를 승인하려면 전체 커밋 SHA를 입력하세요'
}

function Invoke-DemoDeployment([string]$Root, [switch]$Production) {
  $verified = Invoke-DemoVerification $Root
  if ($Production) { Write-Host '같은 커밋의 Draft에서 SSR, API, OAuth, 이미지와 권한 검증을 먼저 완료해야 합니다.' }
  if ((Read-Host (Get-DemoApprovalMessage ([bool]$Production))) -cne $verified.Sha) { throw '명시적인 배포 승인이 없어 중단했습니다.' }
  Push-Location -LiteralPath $Root
  try {
    if ((Get-DemoGitState $Root) -cne $verified.Sha -or (Get-DemoSite $verified.Cli) -cne $verified.SiteId) { throw '승인 이후 커밋 또는 사이트가 변경됐습니다.' }
    $null = Get-DemoBuildEnvironment $verified.Cli
    $mode = 'draft'; if ($Production) { $mode = 'production' }
    $arguments = @('deploy','--no-build','--context','production','--site',$verified.SiteId,'--message',"Demo $mode $($verified.Sha)")
    if ($Production) { $arguments += '--prod' }
    Invoke-DemoCommand $verified.Cli $arguments '승인된 기존 Demo 사이트 배포'
    Write-Host "Netlify Deploys에서 사이트와 배포 커밋을 확인하세요: $($verified.Sha)"
  } finally { Pop-Location }
}
