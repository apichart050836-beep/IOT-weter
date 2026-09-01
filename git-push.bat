@echo off
cd /d "%~dp0"

set /p msg=Enter commit message (Enter for default "update"):
if "%msg%"=="" set msg=update

echo.
echo === git add -A ===
git add -A

echo.
echo === git commit -m "%msg%" ===
git commit -m "%msg%"

echo.
echo === git push ===
git push

echo.
pause
