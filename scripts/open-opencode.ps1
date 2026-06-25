param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3000,
  [string]$OpenCodeExe = "",
  [int]$WaitSeconds = 20,
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$healthUrl = "http://$HostName`:$Port/health"

function Test-ProxyHealth {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    return $health.status -eq "ok"
  } catch {
    return $false
  }
}

function Resolve-OpenCodeExe {
  param([string]$RequestedPath)

  if ($RequestedPath -and (Test-Path $RequestedPath)) {
    return (Resolve-Path $RequestedPath).Path
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\@opencode-aidesktop\OpenCode.exe"),
    (Join-Path $env:LOCALAPPDATA "OpenCode\OpenCode.exe"),
    (Join-Path $env:ProgramFiles "OpenCode\OpenCode.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "OpenCode\OpenCode.exe")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return (Resolve-Path $candidate).Path
    }
  }

  $command = Get-Command OpenCode.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  return $null
}

$resolvedOpenCode = Resolve-OpenCodeExe -RequestedPath $OpenCodeExe
if (-not $resolvedOpenCode) {
  Write-Error "OpenCode Desktop was not found. Install OpenCode Desktop or pass -OpenCodeExe <path>."
  exit 1
}

if (Test-ProxyHealth) {
  Write-Host "OpenCode proxy is already running at $healthUrl"
} else {
  Write-Host "Starting OpenCode proxy..."
  $startProxyScript = Join-Path $PSScriptRoot "start-proxy.ps1"
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$startProxyScript`"",
    "-HostName", $HostName,
    "-Port", [string]$Port
  )
  Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $repoRoot

  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (Test-ProxyHealth) {
      break
    }
  }

  if (-not (Test-ProxyHealth)) {
    Write-Error "Proxy did not become ready at $healthUrl within $WaitSeconds seconds."
    exit 1
  }
}

if ($NoLaunch) {
  Write-Host "OpenCode Desktop is ready to launch: $resolvedOpenCode"
  exit 0
}

Write-Host "Launching OpenCode Desktop..."
Start-Process -FilePath $resolvedOpenCode
