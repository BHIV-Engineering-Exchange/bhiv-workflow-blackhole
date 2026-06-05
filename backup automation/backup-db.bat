@echo off
REM Niyantran Database Backup Wrapper for Windows Command Prompt
powershell -ExecutionPolicy Bypass -File "%~dp0backup-db.ps1"
