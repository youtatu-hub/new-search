#!/usr/bin/env bash

set -euo pipefail

APP_NAME="${APP_NAME:-new-search}"
PORT="${PORT:-3000}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd npm
require_cmd pm2
require_cmd curl

cd "$PROJECT_DIR"

log "当前目录: $PROJECT_DIR"
log "拉取最新代码"
git pull --ff-only

log "安装依赖"
npm install

log "构建项目"
npm run build

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "重启 PM2 应用: $APP_NAME"
  pm2 restart "$APP_NAME" --update-env
else
  log "PM2 应用不存在，按配置启动: $APP_NAME"
  pm2 start ecosystem.config.cjs --only "$APP_NAME"
fi

log "等待服务启动"
sleep 2

log "健康检查"
curl --fail --silent --show-error "http://127.0.0.1:${PORT}/api/health"

log "更新完成"
