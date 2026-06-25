param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$baseUrl = "http://$HostName`:$Port/v1"

Set-Location $repoRoot
Write-Host "Step 1/2: configure OpenCode Desktop for Local Zen Proxy"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "setup-opencode.ps1") -BaseUrl $baseUrl
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Step 2/2: start the local proxy"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-proxy.ps1") -HostName $HostName -Port $Port
exit $LASTEXITCODE
