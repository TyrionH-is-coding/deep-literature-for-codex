$ErrorActionPreference = 'Stop'
$taskRoot = 'C:/tmp/v007'
$packageRoot = "$taskRoot/package/deep-literature-for-codex-0.2.0-dev.5-win-x64"
$evidence = "$taskRoot/evidence"
if (-not (Test-Path -LiteralPath "$evidence/build-manifest-verification.json")) { throw 'verification_required' }
foreach ($name in @('install.stdout.log', 'install.stderr.log', 'install-result.json')) {
  if (Test-Path -LiteralPath "$evidence/$name") { throw ('existing_install_attempt: ' + $name) }
}
$started = [DateTimeOffset]::UtcNow
$arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$packageRoot/install.ps1",
  '-Root', "$taskRoot/instance", '-PluginArchive', "$packageRoot/inputs/scientific-reading.tgz")
$process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait `
  -RedirectStandardOutput "$evidence/install.stdout.log" -RedirectStandardError "$evidence/install.stderr.log"
$exitCode = $process.ExitCode
$result = [ordered]@{
  command = 'powershell.exe'; arguments = $arguments; startedAt = $started.ToString('o')
  finishedAt = [DateTimeOffset]::UtcNow.ToString('o'); exitCode = $exitCode
  installSkill = $false; libraryBackup = $null
  stdout = "$evidence/install.stdout.log"; stderr = "$evidence/install.stderr.log"
}
[System.IO.File]::WriteAllText("$evidence/install-result.json", ($result | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false))
if ($exitCode -ne 0) { throw ('original_installer_failed: ' + $exitCode) }
$result | ConvertTo-Json -Depth 4
