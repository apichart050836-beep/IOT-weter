@echo off
chcp 65001 >nul
cd /d "%~dp0"

set /p msg=กรอกข้อความอธิบายสิ่งที่แก้ (Enter เพื่อใช้ค่าเริ่มต้น "update"):
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
