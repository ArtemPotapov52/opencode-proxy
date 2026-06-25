param(
  [string]$OutputDir = "",
  [string]$Name = "opencode-proxy-release"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutputDir) {
  $OutputDir = Join-Path $root "dist"
}

$outputDirPath = New-Item -ItemType Directory -Force -Path $OutputDir
$stage = Join-Path $outputDirPath.FullName $Name
$zip = Join-Path $outputDirPath.FullName "$Name.zip"

Push-Location $root
try {
  node scripts/secret-scan.mjs
  npm test

  if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
  New-Item -ItemType Directory -Force -Path $stage | Out-Null

  $files = @(
    ".env.example",
    ".gitignore",
    "README.md",
    "QUICKSTART_RU.md",
    "RELEASE_CHECKLIST.md",
    "ROADMAP.md",
    "package.json",
    "doctor.cmd",
    "doctor-factory.cmd",
    "model-health.cmd",
    "start-proxy.cmd",
    "open-opencode.cmd",
    "run-opencode-proxy.cmd",
    "install-opencode.cmd",
    "setup-factory-droid.cmd",
    "cleanup-usage.cmd",
    "secret-scan.cmd",
    "build-release.cmd"
  )

  foreach ($file in $files) {
    if (Test-Path $file) {
      Copy-Item -LiteralPath $file -Destination $stage -Force
    }
  }

  foreach ($dir in @("src", "scripts", "tests")) {
    Copy-Item -LiteralPath $dir -Destination $stage -Recurse -Force
  }

  $blocked = Get-ChildItem -LiteralPath $stage -Recurse -File |
    Where-Object {
      $_.Extension -in @(".exe", ".dll", ".msi") -or
      $_.Name -eq ".env" -or
      $_.FullName -match "\\node_modules\\" -or
      $_.FullName -match "\\.factory\\"
    }

  if ($blocked) {
    $blocked | ForEach-Object { Write-Error "Blocked release file: $($_.FullName)" }
    throw "Release contains blocked files."
  }

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
  Write-Host "[ok] Release zip: $zip"
} finally {
  Pop-Location
}
