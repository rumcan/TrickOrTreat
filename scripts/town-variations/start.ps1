param(
    [ValidateSet('pilot','production','all')][string]$Phase = 'production',
    [ValidateSet('both','codex','run')][string]$Provider = 'run',
    [string]$Until = '2026-10-17T20:00:00+02:00',
    [int]$GapSeconds = 90,
    [string]$Only = '',
    [string]$Out = '',
    [switch]$Resume
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (!$Out) { $Out = Join-Path $repoRoot 'output/imagegen/town-variations/2026-10-17' }
$Out = [IO.Path]::GetFullPath($Out)
if ([DateTimeOffset]::Parse($Until) -le [DateTimeOffset]::Now) { throw 'Until is in the past. Supply a future ISO timestamp including timezone.' }
if ($GapSeconds -lt 0) { throw 'GapSeconds must be non-negative.' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { 'C:\nvm\nvm\v24.21.0\node.exe' }
if (!(Test-Path -LiteralPath $nodeExe)) { throw 'Install Node or add it to PATH first.' }
$codexCommand = Get-Command codex.exe -ErrorAction SilentlyContinue
if ($Provider -ne 'run') {
    if (!$codexCommand) { throw 'Codex CLI was not found. Add codex.exe to PATH.' }
    $env:TOWN_CODEX_CLI = $codexCommand.Source
    if (!$env:CODEX_HOME) { $env:CODEX_HOME = 'C:\Users\Francois Smit\.codex' }
}
$runner = Join-Path $PSScriptRoot 'runner.mjs'
if (!(Test-Path -LiteralPath (Join-Path $Out 'manifest.json'))) {
    & $nodeExe $runner prepare --out $Out
    if ($LASTEXITCODE -ne 0) { throw 'Queue preparation failed.' }
}
if ($Resume) {
    $resumeArgs = @($runner,'resume','--out',$Out)
    if ($Provider -ne 'both') { $resumeArgs += @('--provider',$Provider) }
    & $nodeExe @resumeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Could not clear stop marker.' }
}
if (Test-Path -LiteralPath (Join-Path $Out 'STOP')) { throw 'Queue is stopped. Use -Resume to resume it.' }
$providers = if ($Provider -eq 'both') { @('codex','run') } else { @($Provider) }
foreach ($name in $providers) {
    if (Test-Path -LiteralPath (Join-Path $Out "STOP-$name")) { throw "$name is stopped. Use -Resume." }
    $lockFile = Join-Path $Out "$name.lock/owner.json"
    if (Test-Path -LiteralPath $lockFile) {
        $owner = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json
        if (Get-Process -Id $owner.pid -ErrorAction SilentlyContinue) { Write-Output "$name already running (PID $($owner.pid))"; continue }
    }
    # Paths are quoted as argument values; user/model prompts are passed by the Node worker without a shell.
    $workerArgs = @(('"' + $runner + '"'),'run','--provider',$name,'--phase',$Phase,'--gap',"$GapSeconds",'--until',$Until,'--out',('"' + $Out + '"'))
    if ($Only) { $workerArgs += @('--only',('"' + $Only + '"')) }
    $workerProcess = Start-Process -FilePath $nodeExe -ArgumentList $workerArgs -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Out "$name-console.log") -RedirectStandardError (Join-Path $Out "$name-errors.log")
    Write-Output "$name worker started: PID $($workerProcess.Id), phase $Phase, until $Until"
}
