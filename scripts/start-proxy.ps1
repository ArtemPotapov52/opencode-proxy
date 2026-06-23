param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 18+ is required. Install Node.js, then run this script again."
  exit 1
}

Set-Location $repoRoot
$env:PORT = [string]$Port

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
  if ($health.status -eq "ok") {
    Write-Host "OpenCode proxy is already running on http://127.0.0.1:$Port"
    exit 0
  }
} catch {
  # No proxy is running yet.
}

Write-Host "Starting OpenCode proxy on http://127.0.0.1:$Port"
Write-Host "Keep this window open while using OpenCode Desktop."
npm start
