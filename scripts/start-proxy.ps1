param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 18+ is required. Install Node.js, then run this script again."
  exit 1
}

Set-Location $repoRoot
$env:HOST = $HostName
$env:PORT = [string]$Port

try {
  $health = Invoke-RestMethod -Uri "http://$HostName`:$Port/health" -TimeoutSec 2
  if ($health.status -eq "ok") {
    Write-Host "OpenCode proxy is already running on http://$HostName`:$Port"
    exit 0
  }
} catch {
  # No proxy is running yet.
}

Write-Host "Starting OpenCode proxy on http://$HostName`:$Port"
Write-Host "Keep this window open while using OpenCode Desktop."
npm start
