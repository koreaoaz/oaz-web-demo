param([string]$Library)
. $Library
$script:root = Split-Path -Parent (Split-Path -Parent $Library)
$script:sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$script:id = '2f66ba08-2dd6-4b5d-9156-8c1ad5fd54ad'
$script:cases = 0
function Assert-Test([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message }; $script:cases++ }

# 실제 명령 래퍼 자체의 실패 처리도 확인한다. Git/Netlify/네트워크는 호출하지 않는다.
$failed = $false
try { Invoke-DemoCommand 'oaz-nonexistent-node-executable' @() 'Node.js' } catch { $failed = $_.Exception.Message -eq 'Node.js 실행에 실패했습니다. 명령 설치와 인증을 확인하세요.' }
Assert-Test $failed '설치되지 않은 Node 안내'
$engine = (Get-Process -Id $PID).Path
$failed = $false
try { Invoke-DemoCommand $engine @('-NoProfile','-Command','exit 7') '가짜 실패' } catch { $failed = $_.Exception.Message -eq '가짜 실패 검사에 실패했습니다. 종료 코드: 7' }
Assert-Test $failed '명령 실패 안내'
if ($env:OS -eq 'Windows_NT') {
  $fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('oaz-command-fixture-' + [Guid]::NewGuid().ToString('N'))
  $originalPath = $env:Path
  try {
    $firstDirectory = Join-Path $fixtureRoot 'first path'
    $secondDirectory = Join-Path $fixtureRoot 'second path'
    [void](New-Item -ItemType Directory -Path $firstDirectory, $secondDirectory)
    [IO.File]::WriteAllText((Join-Path $firstDirectory 'oaz-path-probe.cmd'), "@echo first`r`n", [Text.Encoding]::ASCII)
    [IO.File]::WriteAllText((Join-Path $secondDirectory 'oaz-path-probe.cmd'), "@echo second`r`n", [Text.Encoding]::ASCII)
    [IO.File]::WriteAllText((Join-Path $firstDirectory 'oaz-stderr-probe.cmd'), "@echo fixture_secret_value 1>&2`r`n@exit /b 7`r`n", [Text.Encoding]::ASCII)
    [IO.File]::WriteAllText((Join-Path $firstDirectory 'oaz-context-probe.cmd'), "@echo --context flag is only available when using the --build flag 1>&2`r`n@echo fixture_secret_value 1>&2`r`n@exit /b 1`r`n", [Text.Encoding]::ASCII)
    [IO.File]::WriteAllBytes((Join-Path $firstDirectory 'oaz-invalid-probe.exe'), [byte[]](0, 1, 2))
    $env:Path = "$firstDirectory;$secondDirectory;$originalPath"
    Assert-Test (@(Get-Command oaz-path-probe.cmd -CommandType Application).Count -ge 2) '중복 PATH 재현'
    Assert-Test ((Invoke-DemoCommand 'oaz-path-probe.cmd' @() 'PATH 순서' -Capture) -ceq 'first') '첫 실행 파일 사용'
    Assert-Test ((Invoke-DemoCommand 'node' @('--version') 'Node.js' -Capture) -ceq (& node --version)) '실제 Node 버전 호출'
    $failed = $false
    try { Invoke-DemoCommand 'oaz-stderr-probe.cmd' @() '가짜 stderr' } catch {
      $failed = $_.Exception.Message -match '종료 코드: 7' -and $_.Exception.Message -notmatch 'fixture_secret_value'
    }
    Assert-Test $failed '종료 코드 확인 및 stderr 비노출'
    $failed = $false
    try { Invoke-DemoCommand 'oaz-context-probe.cmd' @() '승인된 기존 Demo 사이트 배포' } catch {
      $failed = $_.Exception.Message -match 'context' -and $_.Exception.Message -notmatch 'fixture_secret_value'
    }
    Assert-Test $failed '알려진 인수 충돌을 안내하고 stderr 원문은 숨김'
    $failed = $false
    try { Invoke-DemoCommand 'oaz-invalid-probe.exe' @() '가짜 실행 오류' } catch {
      $failed = $_.Exception.Message -match '^가짜 실행 오류 실행에 실패했습니다\. 오류 종류: [A-Za-z0-9_]+$' -and $_.Exception.Message -notmatch 'oaz-invalid-probe'
    }
    Assert-Test $failed '실행 예외 종류만 표시'
  } finally {
    $env:Path = $originalPath
    if ([IO.Path]::GetDirectoryName($fixtureRoot) -ceq [IO.Path]::GetTempPath().TrimEnd('\') -and [IO.Path]::GetFileName($fixtureRoot).StartsWith('oaz-command-fixture-')) {
      Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction Stop
    } else { throw '임시 테스트 경로 확인 실패' }
  }
}
foreach ($version in @('22.13.0','v22.14.0','22.23.4','22.13.0+build.1')) { Assert-DemoNodeVersion $version; Assert-Test $true '허용 버전' }
foreach ($version in @('20.19.0','22.0.0','22.12.9','23.0.0','24.0.0','22.13.0-rc.1','','garbage','22.013.0','22.13','999999999999999999999.13.0')) {
  $failed = $false; try { Assert-DemoNodeVersion $version } catch { $failed = $_.Exception.Message -match '22.13.0' }; Assert-Test $failed "버전 거부 $version"
}
Assert-Test ((Get-DemoApprovalMessage $true) -ceq 'Production 배포를 승인하려면 전체 커밋 SHA를 입력하세요') 'Production 한글 승인 문구'
Assert-Test ((Get-DemoApprovalMessage $false) -ceq 'Draft 배포를 승인하려면 전체 커밋 SHA를 입력하세요') 'Draft 한글 승인 문구'
foreach ($claims in @(@{role='anon'; ref='ctbwaqtqubmjmltbxfzm'}, @{role='service_role'; ref='ctbwaqtqubmjmltbxfzm'}, @{role='anon'; ref='maoefmwpdcnugyenyiea'})) {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($claims | ConvertTo-Json -Compress))).TrimEnd('=').Replace('+','-').Replace('/','_')
  $accepted = $true
  try { Assert-DemoPublicKey "fake.$encoded.fake" } catch { $accepted = $false }
  Assert-Test ($accepted -eq ($claims.role -eq 'anon' -and $claims.ref -eq 'ctbwaqtqubmjmltbxfzm')) 'legacy 공개키와 서버/운영 키 구분'
}

function Reset-Mock([string]$Scenario) {
  $script:scenario = $Scenario; $script:calls = New-Object System.Collections.Generic.List[string]
  $script:approved = $false; $script:prompt = ''; $script:deployArgs = @()
}
# 이 함수가 모든 외부 호출을 가로챈다. 알려지지 않은 호출은 성공 처리하지 않는다.
function Invoke-DemoCommand([string]$Command, [string[]]$Arguments, [string]$Label, [switch]$Capture) {
  $joined = $Arguments -join ' '; $script:calls.Add("$Command $joined")
  if ($script:scenario -eq 'assets-after-approval' -and $joined -eq 'scripts/verify-static-assets.mjs' -and $script:approved) { throw '배포 직전 정적 파일 없음' }
  if ($script:scenario -eq 'command-failure' -and $joined -eq 'run lint') { throw 'ESLint 검사에 실패했습니다.' }
  $failCommands = @{'fail-cli-install'='ci --prefix tools/netlify'; 'fail-install'='ci'; 'fail-types'='tsc --noEmit'; 'fail-tests'='--test --test-concurrency=1 tests/*.test.mjs'; 'fail-build'='build --context production'; 'fail-assets'='scripts/verify-static-assets.mjs'}
  if ($failCommands.ContainsKey($script:scenario) -and $joined -eq $failCommands[$script:scenario]) { throw '모의 검증 명령 실패' }
  if ($Command -eq 'node' -and $joined -eq '--version') { if ($script:scenario -eq 'node-low') { return 'v22.12.9' }; return 'v22.23.4' }
  if ($Command -eq 'git') {
    switch ($joined) {
      'rev-parse --show-toplevel' { if ($script:scenario -eq 'wrong-root') { return (Split-Path -Parent $script:root) }; return $script:root }
      'branch --show-current' { if ($script:scenario -eq 'wrong-branch') { return 'demo' }; return 'main' }
      'status --porcelain' { if ($script:scenario -eq 'dirty') { return ' M file.ts' }; return '' }
      'remote get-url origin' { if ($script:scenario -eq 'wrong-origin') { return 'https://github.com/koreaoaz/oazkorea_web.git' }; return 'https://github.com/koreaoaz/oaz-web-demo.git' }
      'remote get-url --push origin' { if ($script:scenario -eq 'wrong-push') { return 'https://github.com/koreaoaz/oazkorea_web.git' }; return 'https://github.com/koreaoaz/oaz-web-demo.git' }
      'rev-parse HEAD' { return $script:sha }
      'ls-remote --exit-code origin refs/heads/main' {
        if ($script:scenario -eq 'remote-changed' -or ($script:scenario -eq 'changed-after-approval' -and $script:approved)) { return ('b' * 40) + "`trefs/heads/main" }
        return $script:sha + "`trefs/heads/main"
      }
      default { throw "허용하지 않은 Git 호출 $joined" }
    }
  }
  if ($joined -eq 'status --json') {
    if ($script:scenario -eq 'bad-json') { return '{invalid' }
    $siteName = 'oneandzero-demo'; $siteUrl = 'https://oneandzero-demo.netlify.app'; $siteId = $script:id
    if ($script:scenario -eq 'bad-site') { $siteName = 'other' }
    if ($script:scenario -eq 'bad-id') { $siteId = '12345678-1234-1234-1234-123456789abc' }
    if ($script:scenario -eq 'auth-failure') { throw '모의 인증 실패' }
    if ($script:scenario -eq 'bad-site-url') { $siteUrl = 'https://other.netlify.app' }
    if ($script:scenario -eq 'site-changed' -and $script:approved) { $siteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }
    return (@{loggedIn=$true; linked=$true; siteData=@{'site-name'=$siteName; 'site-url'=$siteUrl; 'site-id'=$siteId}} | ConvertTo-Json -Compress)
  }
  if ($Arguments[0] -eq 'env:get') {
    $value = 'sb_publishable_fake_test_only'
    if ($Arguments[1] -eq 'NEXT_PUBLIC_SUPABASE_URL') { $value = 'https://ctbwaqtqubmjmltbxfzm.supabase.co'; if ($script:scenario -eq 'production-url') { $value = 'https://maoefmwpdcnugyenyiea.supabase.co' } }
    elseif ($script:scenario -eq 'secret-key') { $value = 'sb_secret_fake_test_only' }
    elseif ($script:scenario -eq 'scope-mismatch' -and $joined -match 'functions') { $value = 'sb_publishable_different_test_only' }
    if ($script:scenario -eq 'missing-env') { return '{}' }
    $item = @{}; $item[$Arguments[1]] = $value; return ($item | ConvertTo-Json -Compress)
  }
  if ($Arguments[0] -eq 'deploy') { $script:deployArgs = $Arguments; if ($script:scenario -eq 'deploy-failure') { throw '배포가 실패했습니다.' }; return }
  if ($joined -in @('ci --prefix tools/netlify','ci','tsc --noEmit','run lint','--test --test-concurrency=1 tests/*.test.mjs','build --context production','scripts/verify-static-assets.mjs')) { return }
  throw "모의 처리하지 않은 명령: $Command $joined"
}
function Read-Host([string]$Prompt) { $script:prompt = $Prompt; $script:approved = $true; if ($script:scenario -eq 'cancel') { return '' }; if ($script:scenario -eq 'wrong-approval') { return $script:sha.Substring(0,7) }; return $script:sha }

$saved = @{}
foreach ($name in @('NETLIFY_AUTH_TOKEN','NETLIFY_SITE_ID','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_KEY')) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process'); [Environment]::SetEnvironmentVariable($name,$null,'Process') }
try {
  foreach ($production in @($false,$true)) {
    Reset-Mock 'success'
    Invoke-DemoDeployment $script:root -Production:$production
    Assert-Test ($script:deployArgs -contains '--no-build') '검증된 산출물만 배포'
    Assert-Test (($script:deployArgs -contains '--prod') -eq $production) 'Draft와 Production 분리'
    Assert-Test ($script:deployArgs[3] -eq '.netlify/static') '정적 배포 경로 지정'
    Assert-Test ($script:deployArgs[5] -eq $script:id) '기존 사이트 ID 지정'
    Assert-Test (-not ($script:deployArgs -contains '--context')) '빌드 생략 시 context 금지'
    Assert-Test ($script:deployArgs[7] -match $script:sha) '전체 SHA 기록'
    Assert-Test ($script:prompt -ceq (Get-DemoApprovalMessage $production)) '실제 승인 프롬프트'
    Assert-Test (@($script:calls | Where-Object { $_ -match 'ls-remote' }).Count -eq 3) '검증 전후 및 승인 후 원격 SHA 조회'
  }
  foreach ($scenario in @('cancel','wrong-approval','node-low','wrong-root','wrong-branch','dirty','wrong-origin','wrong-push','remote-changed','changed-after-approval','bad-json','auth-failure','bad-site','bad-id','bad-site-url','site-changed','production-url','secret-key','scope-mismatch','missing-env','command-failure','fail-cli-install','fail-install','fail-types','fail-tests','fail-build','fail-assets','assets-after-approval')) {
    Reset-Mock $scenario; $failed = $false
    try { Invoke-DemoDeployment $script:root -Production } catch { $failed = $true; if ($scenario -eq 'cancel') { Assert-Test ($_.Exception.Message -ceq '명시적인 배포 승인이 없어 중단했습니다.') '한글 취소 안내' } }
    Assert-Test $failed "안전 차단 $scenario"
    Assert-Test ($script:deployArgs.Count -eq 0) "배포 요청 없음 $scenario"
    if ($scenario -eq 'command-failure') { Assert-Test (-not ($script:calls -match 'build --context')) 'lint 실패 후 빌드 중단' }
  }
  Reset-Mock 'deploy-failure'; $failed = $false
  try { Invoke-DemoDeployment $script:root } catch { $failed = $_.Exception.Message -ceq '배포가 실패했습니다.' }
  Assert-Test $failed '배포 실패를 성공 처리하지 않음'
  foreach ($name in @('NETLIFY_AUTH_TOKEN','NETLIFY_SITE_ID','NEXT_PUBLIC_SUPABASE_URL')) {
    Reset-Mock 'success'; $failed = $false
    [Environment]::SetEnvironmentVariable($name,'fake_test_override','Process')
    try { Invoke-DemoDeployment $script:root } catch { $failed = $true } finally { [Environment]::SetEnvironmentVariable($name,$null,'Process') }
    Assert-Test $failed '외부 환경변수 충돌 차단'
    Assert-Test ($script:deployArgs.Count -eq 0) '환경변수 충돌 시 배포 요청 없음'
  }
  [Console]::WriteLine((@{cases=$script:cases; version=$PSVersionTable.PSVersion.ToString(); production=(Get-DemoApprovalMessage $true); cancel='명시적인 배포 승인이 없어 중단했습니다.'} | ConvertTo-Json -Compress))
} finally { foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') } }
