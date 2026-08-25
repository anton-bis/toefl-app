# One-shot license dev environment: mock server + Electron.
# Usage:  .\scripts\dev-license.ps1
# Stops the mock server automatically when Electron exits.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host 'Starting mock license server on http://localhost:3001 ...'
$server = Start-Process -FilePath 'node.exe' -ArgumentList 'scripts/mock-license-server.js' -PassThru -NoNewWindow
Start-Sleep -Milliseconds 1200

try {
  $env:TOEFL_API_BASE_URL = 'http://localhost:3001'
  npm run electron:dev
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\TOEFL_API_BASE_URL -ErrorAction SilentlyContinue
  Write-Host 'Mock license server stopped.'
}
