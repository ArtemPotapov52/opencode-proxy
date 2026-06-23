param(
  [string]$ConfigDir = "",
  [string]$ProviderId = "zenproxy",
  [string]$BaseUrl = "http://127.0.0.1:3000/v1",
  [string]$ApiKey = "public",
  [string]$Model = "deepseek-v4-flash-free",
  [string]$SmallModel = "mimo-v2.5-free",
  [switch]$NoInstall,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 18+ is required. Install Node.js, then run this script again."
  exit 1
}

$scriptPath = Join-Path $PSScriptRoot "setup-opencode.mjs"
$argsList = @($scriptPath, "--provider-id", $ProviderId, "--base-url", $BaseUrl, "--api-key", $ApiKey, "--model", $Model, "--small-model", $SmallModel)

if ($ConfigDir) {
  $argsList += @("--config-dir", $ConfigDir)
}

if ($NoInstall) {
  $argsList += "--no-install"
}

if ($DryRun) {
  $argsList += "--dry-run"
}

& node @argsList
exit $LASTEXITCODE
