param([switch]$Production)
# 검증/승인 실패 시 배포하지 않는다. 자동 사이트 생성은 지원하지 않는다.
. (Join-Path $PSScriptRoot 'release-lib.ps1')
Invoke-DemoDeployment (Split-Path -Parent $PSScriptRoot) -Production:$Production
