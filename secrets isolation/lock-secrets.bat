@echo off
REM Niyantran Secrets Lockdown Wrapper for Windows Command Prompt
powershell -ExecutionPolicy Bypass -File "%~dp0lock-secrets.ps1"
pause
