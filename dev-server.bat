@echo off
cd /d "%~dp0"
:loop
echo [%date% %time%] Starting Next.js dev server...
call npm run dev
echo.
echo [%date% %time%] Dev server stopped (exit code %errorlevel%). Restarting in 3 seconds...
echo (Press Ctrl+C then Y to stop for good.)
timeout /t 3 >nul
goto loop
