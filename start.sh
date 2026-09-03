#!/usr/bin/env bash
# ================================================================
#  8-BIT 地牢求生 - 一键本地启动
#  用法: bash start.sh
# ================================================================
set -euo pipefail
PORT=${PORT:-8080}

# 检测 python3
if command -v python3 &>/dev/null; then
  SERVER="python3 -m http.server $PORT"
elif command -v python &>/dev/null; then
  SERVER="python -m http.server $PORT"
elif command -v node &>/dev/null; then
  SERVER="npx -y serve -l $PORT ."
else
  echo "❌ 未检测到 python3 / python / node，请先安装任意一个"
  echo "   macOS:  brew install python3"
  echo "   Windows: https://www.python.org/downloads/"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🎮 8-BIT DUNGEON SURVIVAL - 启动中      ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  📡 访问地址:  http://localhost:$PORT         ║"
echo "║  🖥️  服务进程:  $SERVER"
echo "║  ⏹️  停止服务:  Ctrl + C                      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "浏览器将在 3 秒后自动打开..."
( sleep 3 && open "http://localhost:$PORT" 2>/dev/null \
         || xdg-open "http://localhost:$PORT" 2>/dev/null \
         || echo "👉 请手动打开: http://localhost:$PORT" ) &

$SERVER
