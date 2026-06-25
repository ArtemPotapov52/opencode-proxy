@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-opencode.ps1" %*
echo.
pause
