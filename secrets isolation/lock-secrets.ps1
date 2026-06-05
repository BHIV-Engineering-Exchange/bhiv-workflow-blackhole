# Niyantran Secrets Isolation Script for Windows
# This script uses icacls to secure the .env.production file.

$EnvFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.env.production"))

if (-not (Test-Path $EnvFile)) {
    Write-Warning "[WARN] Secrets file not found at: $EnvFile"
    Write-Host "[*] Creating an empty .env.production file to secure..." -ForegroundColor Gray
    New-Item -ItemType File -Path $EnvFile -Force | Out-Null
}

Write-Host "[+] Securing Secrets File: $EnvFile" -ForegroundColor Cyan

# 1. Remove inheritance and clear all inherited permissions
& icacls.exe "$EnvFile" /inheritance:r | Out-Null

# 2. Grant Full Control to the current user
$CurrentUser = $env:USERNAME
& icacls.exe "$EnvFile" /grant:r "${CurrentUser}:(F)" | Out-Null

# 3. Grant Full Control to the SYSTEM account
& icacls.exe "$EnvFile" /grant:r "SYSTEM:(F)" | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Secrets file permissions locked successfully." -ForegroundColor Green
    Write-Host "[OK] Only you ($CurrentUser) and the SYSTEM process can access .env.production." -ForegroundColor Green
} else {
    Write-Warning "[ERROR] Failed to secure file permissions."
}
