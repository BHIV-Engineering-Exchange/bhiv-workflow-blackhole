# Niyantran Secrets Isolation Script for Windows
# Secures .env (live CI naming) or .env.production (legacy local naming).

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$EnvCandidates = @(
    (Join-Path $Root ".env"),
    (Join-Path $Root ".env.production")
)

$EnvFile = $EnvCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $EnvFile) {
    $EnvFile = Join-Path $Root ".env"
    Write-Warning "[WARN] Secrets file not found. Creating empty .env to secure: $EnvFile"
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
    Write-Host "[OK] Only you ($CurrentUser) and the SYSTEM process can access $(Split-Path $EnvFile -Leaf)." -ForegroundColor Green
} else {
    Write-Warning "[ERROR] Failed to secure file permissions."
}
