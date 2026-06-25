@echo off
setlocal
node "%~dp0scripts\proxy-status.mjs" %*
echo.
pause
