@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js first: https://nodejs.org & start https://nodejs.org & pause & exit /b)
if not exist node_modules call npm install
node server.js
pause
