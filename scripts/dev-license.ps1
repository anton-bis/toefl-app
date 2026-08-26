# One-shot license dev environment: mock server + Electron.
# Usage:  .\scripts\dev-license.ps1
# Uses port 3002 by default (3001 is often taken by the toefl-web dev server).
# Creates a fresh isolated userData so workspace content (new questions) loads.
# Stops the mock server automatically when Electron exits.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$port = if ($env:PORT) { $env:PORT } else { '3002' }
$iso = if ($env:TOEFL_PERF_USER_DATA) {
  $env:TOEFL_PERF_USER_DATA
} else {
  Join-Path $env:TEMP 'opencode\toefl-preview-userdata'
}
if (Test-Path $iso) { Remove-Item $iso -Recurse -Force }
New-Item -ItemType Directory -Path $iso -Force | Out-Null

$env:PORT = $port
Write-Host "Starting mock license server on http://localhost:$port ..."
$server = Start-Process -FilePath 'node.exe' -ArgumentList 'scripts/mock-license-server.js' -WorkingDirectory $root -PassThru -NoNewWindow
Start-Sleep -Milliseconds 1200

try {
  $env:ELECTRON = 'true'
  $env:NODE_ENV = 'production'
  $env:TOEFL_API_BASE_URL = "http://localhost:$port"
  $env:TOEFL_PERF_USER_DATA = $iso
  npm run electron:dev
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\TOEFL_API_BASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\TOEFL_PERF_USER_DATA -ErrorAction SilentlyContinue
  Remove-Item Env:\PORT -ErrorAction SilentlyContinue
  Write-Host 'Mock license server stopped.'
}
