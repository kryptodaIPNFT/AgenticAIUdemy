# Start Westmont portal with ngrok PUBLIC_URL for mobile QR testing.
# Prerequisites: npm start NOT already using port 3000 with wrong env, ngrok running "ngrok http 3000"

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Waiting for ngrok local API (http://127.0.0.1:4040)..." -ForegroundColor Cyan
$publicUrl = $null
for ($i = 0; $i -lt 15; $i++) {
  try {
    $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
    $publicUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url
    if ($publicUrl) { break }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $publicUrl) {
  Write-Host ""
  Write-Host "Could not detect ngrok tunnel." -ForegroundColor Red
  Write-Host "1. Install ngrok: https://ngrok.com/download"
  Write-Host "2. In another terminal run:  ngrok http 3000"
  Write-Host "3. Re-run this script"
  exit 1
}

Write-Host ""
Write-Host "Ngrok URL: $publicUrl" -ForegroundColor Green
Write-Host "Open this URL on DESKTOP, then Show QR code and scan with your phone." -ForegroundColor Yellow
Write-Host ""

$env:PUBLIC_URL = $publicUrl
node server.js
