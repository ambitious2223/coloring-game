@echo off
setlocal
cd /d "%~dp0"
title Color Chaos

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is required but was not found.
  echo   Install Node 20 or newer from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo   First run: installing dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed. See the messages above.
    pause
    exit /b 1
  )
)

echo.
echo   Starting Color Chaos on http://localhost:45125
echo   (A server window opens; leave it running. Close it to stop the game.)
echo.

start "Color Chaos Server" cmd /k "npm run serve"
timeout /t 2 /nobreak >nul
start "" "http://localhost:45125"
exit /b 0
