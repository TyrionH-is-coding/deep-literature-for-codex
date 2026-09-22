$ErrorActionPreference = 'Stop'
$repo = 'C:/Users/15694/Documents/ChatGPT/deep-literature-v02-007'
$taskRoot = 'C:/tmp/v007'
$archive = 'C:/tmp/v006/candidate-r4/deep-literature-for-codex-0.2.0-dev.5-win-x64.zip'
$expectedSha = 'cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044'
$utf8 = [System.Text.UTF8Encoding]::new($false)
foreach ($reserved in @('package', 'instance', 'evidence')) {
  if (Test-Path -LiteralPath "$taskRoot/$reserved") { throw ('v007_reserved_path_already_exists: ' + $reserved) }
}
if ((git -C $repo rev-parse HEAD).Trim() -ne '7d53ab5b3c66fdee77820b64d94c8a49ea03ed97') { throw 'unexpected_base' }
if ((git -C $repo branch --show-current).Trim() -ne 'codex/v02-007-real-use') { throw 'unexpected_branch' }
$started = [DateTimeOffset]::UtcNow
$receipt = [ordered]@{
  taskId = 'V02-007'
  agentTaskId = '/root/v007_instance_setup'
  ownerSession = '01a0acfe-116b-7870-a839-9cd0c36fbb89'
  phase = 'bounded_installation_preparation'
  baseCommit = '7d53ab5b3c66fdee77820b64d94c8a49ea03ed97'
  contextCommit = 'aecd648fa4207bb11b219a04ef2e9c068da6de20'
  worktree = $repo
  branch = 'codex/v02-007-real-use'
  cleanAtInitialInspection = $true
  initialInspectionAt = $null
  startedAt = $started.ToString('o')
  nextCheckpointAt = $started.AddMinutes(90).ToString('o')
  taskRoot = $taskRoot
  packageContainer = "$taskRoot/package"
  packageRoot = "$taskRoot/package/deep-literature-for-codex-0.2.0-dev.5-win-x64"
  instanceRoot = "$taskRoot/instance"
  portPolicy = 'OS-assigned loopback port'
  candidateArchive = $archive
  candidateSha256 = $expectedSha
  allowedPaths = @('scripts/v02-007-*', 'scripts/fixtures/v02-007/', 'docs/project/evidence/V02-007*', 'C:/tmp/v007/')
  boundary = 'Preparation only; no old credentials, user Skill, login, ingest, submit, dispatch, model or MinerU calls.'
}
New-Item -ItemType Directory -Path "$taskRoot/evidence" | Out-Null
$receiptText = $receipt | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText("$taskRoot/evidence/receipt.json", $receiptText, $utf8)
[System.IO.File]::WriteAllText("$repo/docs/project/evidence/V02-007-receipt.json", $receiptText, $utf8)
$actualSha = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -ne $expectedSha) { throw 'candidate_sha256_mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath "$taskRoot/package"
[System.IO.File]::WriteAllText("$taskRoot/evidence/archive.json", (@{
  path = $archive; sha256 = $actualSha; bytes = (Get-Item -LiteralPath $archive).Length
  extractedTo = "$taskRoot/package"; checkedAt = [DateTimeOffset]::UtcNow.ToString('o')
} | ConvertTo-Json), $utf8)
Get-ChildItem -LiteralPath "$taskRoot/package" | Select-Object Name,Mode
