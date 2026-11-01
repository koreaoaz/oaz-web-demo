# Windows PowerShell 5.1과 PowerShell 7 공용. UTF-8 BOM을 유지한다.
. (Join-Path $PSScriptRoot 'release-lib.ps1')
[void](Invoke-DemoVerification (Split-Path -Parent $PSScriptRoot))
