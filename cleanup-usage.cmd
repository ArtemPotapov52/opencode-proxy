@echo off
setlocal
node "%~dp0scripts\cleanup-usage.mjs" %*
echo.
pause
