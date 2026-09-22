param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$root = 'C:/tmp/v005/instance'
$installed = Get-Content -Raw -LiteralPath "$root/installation.json" | ConvertFrom-Json
$identity = Get-Content -Raw -LiteralPath "$root/.workbench.json" | ConvertFrom-Json
if ($identity.instanceId -ne '4495c8ba-c27b-4bdb-9bf8-54551fc0171f') { throw 'v005_instance_mismatch' }
$cli = Join-Path $installed.app 'src/cli.mjs'
if ($Stop) { & $installed.node $cli stop $root; exit $LASTEXITCODE }
& $installed.node $cli start $root
if ($LASTEXITCODE -ne 0) { throw 'start_failed' }
$utf8 = [System.Text.UTF8Encoding]::new($false)
foreach ($paper in @('title_d8b339a0356f','title_7f6d8e6af6fb','title_a28e4c422f5c')) {
    $request = @{action='reader';payload=@{paperId=$paper}} | ConvertTo-Json -Depth 4
    $file = "C:/tmp/v005/reopen-$paper.json"
    [System.IO.File]::WriteAllText($file,$request,$utf8)
    & $installed.node $cli call $root $file
    if ($LASTEXITCODE -ne 0) { throw 'reader_verification_failed' }
}
