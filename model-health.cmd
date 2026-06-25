@echo off
setlocal
node "%~dp0scripts\model-health.mjs" %*
echo.
pause
