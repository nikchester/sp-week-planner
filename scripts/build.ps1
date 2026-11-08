# Packs week-planner/ into dist/week-planner-<version>.zip (files at the archive root).
# Run: pwsh scripts/build.ps1   (or: powershell -File scripts/build.ps1)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'week-planner'
$version = (Get-Content (Join-Path $src 'manifest.json') -Raw | ConvertFrom-Json).version
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "week-planner-$version.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip
Write-Output $zip
