@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js before using this browser edition.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5174/ in your browser after the server starts.
node sitefoundry-server.mjs
pause
