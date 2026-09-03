@echo off
chcp 65001 >nul
title 8-BIT 地牢求生

set PORT=8080

where python3 >nul 2>nul
if %errorlevel%==0 (
  set SERVER=python3 -m http.server %PORT%
  goto :run
)
where python >nul 2>nul
if %errorlevel%==0 (
  set SERVER=python -m http.server %PORT%
  goto :run
)
where node >nul 2>nul
if %errorlevel%==0 (
  set SERVER=npx -y serve -l %PORT% .
  goto :run
)

echo ❌ 未检测到 python3 / python / node，请先安装任意一个
echo    Python: https://www.python.org/downloads/
echo    Node.js: https://nodejs.org/
pause
exit /b 1

:run
echo.
echo ╔══════════════════════════════════════════════╗
echo ║     🎮 8-BIT DUNGEON SURVIVAL - 启动中      ║
echo ╠══════════════════════════════════════════════╣
echo ║  📡 访问地址:  http://localhost:%PORT%         ║
echo ║  ⏹️  停止服务:  Ctrl + C                      ║
echo ╚══════════════════════════════════════════════╝
echo.
echo 浏览器将在 3 秒后自动打开...
start "" http://localhost:%PORT%

%SERVER%
