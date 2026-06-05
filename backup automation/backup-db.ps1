# Niyantran Database Backup Script for Windows
# This script dumps the MongoDB database container data and keeps a rolling 7-day archive.

# Define directories relative to script path
$BackupDir = Join-Path $PSScriptRoot "..\backups"
$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$BackupFileName = "mongodb_backup_$Timestamp.gz"
$BackupPath = [System.IO.Path]::GetFullPath((Join-Path $BackupDir $BackupFileName))

# Create Backup Directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "[+] Starting MongoDB Backup..." -ForegroundColor Cyan
Write-Host "[+] Destination: $BackupPath" -ForegroundColor Gray

# We use cmd.exe /c to handle binary redirection safely without PowerShell string corruption
& cmd /c "docker exec niyantran_database mongodump --archive --gzip > `"$BackupPath`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Backup completed successfully." -ForegroundColor Green
} else {
    Write-Warning "[ERROR] Backup failed! Ensure docker container 'niyantran_database' is running."
    exit 1
}

# Clean up backups older than 7 days
Write-Host "[+] Cleaning up backups older than 7 days..." -ForegroundColor Cyan
$CutoffDate = (Get-Date).AddDays(-7)
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "mongodb_backup_*.gz" | Where-Object { $_.LastWriteTime -lt $CutoffDate }

foreach ($Backup in $OldBackups) {
    Write-Host "[-] Removing old backup: $($Backup.FullName)" -ForegroundColor Yellow
    Remove-Item $Backup.FullName -Force
}

Write-Host "[OK] Maintenance complete." -ForegroundColor Green
