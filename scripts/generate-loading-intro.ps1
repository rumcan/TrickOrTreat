param(
    [ValidateSet('draft', 'final')]
    [string]$Quality = 'draft',
    [switch]$Generate,
    [switch]$Resume
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$referencePath = Join-Path $projectRoot 'art\new\new-menu\c84fbc37-26f1-4649-bda2-ea7e953eb0ba.png'
$promptPath = Join-Path $projectRoot 'art\intro\town-reveal.prompt.txt'
$introDirectory = Join-Path $projectRoot 'art\intro'
$runCli = (Get-Command rundot.exe -ErrorAction Stop).Source
$provider = if ($Quality -eq 'final') { 'seedance-2.0' } else { 'seedance-2.0-fast' }
$resolution = if ($Quality -eq 'final') { '1080p' } else { '720p' }
# Exact account/game-scoped estimates read from RUN on 2026-10-15.
# This cap rejects a charge above the reviewed amount if pricing changes.
$creditCap = if ($Quality -eq 'final') { 8184 } else { 2904 }
$outputPath = Join-Path $introDirectory "town-reveal-$resolution-v1.mp4"

if (!(Test-Path -LiteralPath $referencePath -PathType Leaf)) {
    throw "The supplied town reference is missing: $referencePath"
}

$commonArguments = @(
    '--game-id', 'AFjPSjQH9kbcCl57sgO3',
    '--provider', $provider,
    '--mode', 'reference-to-video',
    '--duration', '8',
    '--resolution', $resolution
)

if (!$Generate -and !$Resume) {
    & $runCli generate estimate video @commonArguments --json
    if ($LASTEXITCODE -ne 0) { throw 'RUN could not estimate the intro.' }
    Write-Output "Estimate only. To generate: .\scripts\generate-loading-intro.ps1 -Quality $Quality -Generate"
    exit 0
}

$shotPrompt = Get-Content -LiteralPath $promptPath -Encoding UTF8 -Raw
$generationArguments = @(
    'generate', 'video',
    '--prompt', $shotPrompt,
    '--image-reference', $referencePath,
    '--aspect-ratio', '16:9',
    '--seed', '31102026',
    '--client-ref', "tot-loading-town-reveal-$resolution-v1",
    '--request-origin', 'loading-intro',
    '--max-credits', "$creditCap",
    '--idempotency-key', "tot-loading-town-reveal-$resolution-v1",
    '--out', $outputPath,
    '--json'
) + $commonArguments
if ($Resume) { $generationArguments += '--resume' }

Push-Location $projectRoot
try {
    & $runCli @generationArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'RUN did not complete the clip. Use -Resume to check the same job without submitting another generation.'
    }
} finally {
    Pop-Location
}
