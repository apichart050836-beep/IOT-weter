@echo off
cd /d "%~dp0"
echo Starting Next.js dev server in a new window (auto-restarts if it crashes)...
start "waterpum dev server" cmd /k "%~dp0dev-server.bat"
echo Waiting for server to start...
timeout /t 6 /nobreak >nul
start "" http://localhost:3000/dashboard
echo Browser opened at http://localhost:3000/dashboard
echo (If the page shows an error, wait a few seconds and refresh - the server may still be starting.)
pause
