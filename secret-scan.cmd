@echo off
setlocal
node "%~dp0scripts\secret-scan.mjs" %*
echo.
pause
