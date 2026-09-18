$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force outputs/v02-004i/tmp | Out-Null
$env:TEMP = (Resolve-Path outputs/v02-004i/tmp).Path
$env:TMP = $env:TEMP
$evidence = 'docs/project/evidence'
$runs = @()
function Run-Check($name, $exe, $arguments) {
    $started = [DateTime]::UtcNow.ToString('o')
    & $exe @arguments > "$evidence/V02-004I-$name.txt" 2>&1
    $code = $LASTEXITCODE
    $script:runs += [ordered]@{name=$name; command=$exe; args=$arguments; started=$started; exitCode=$code}
    $script:runs | ConvertTo-Json -Depth 8 | Set-Content "$evidence/V02-004I-runs.json"
    if ($code -ne 0) { throw "$name failed: $code" }
}
Run-Check 'check' 'npm.cmd' @('run', 'modules', '--', 'check')
Run-Check 'impact' 'npm.cmd' @('run', 'modules', '--', 'impact', '--base', '21e34c9763859442df33d047d12749e9a8b53744')
Run-Check 'bridge' 'npm.cmd' @('run', 'modules', '--', 'test', 'bridge')
Run-Check 'workflow' 'npm.cmd' @('run', 'modules', '--', 'test', 'workflow')
Run-Check 'integration' 'node.exe' @('scripts/v02-004i-integration.mjs', 'final')
Write-Output "PASS: $($runs.Count) frozen-source module, caller and real integration checks"
