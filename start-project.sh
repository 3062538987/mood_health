#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/mood-health-server"
PM2_ENTRY="$ROOT_DIR/node_modules/pm2/bin/pm2"

log() {
  echo "[INFO] $1"
}

fail() {
  echo "[ERROR] $1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "node is not available"
command -v npm >/dev/null 2>&1 || fail "npm is not available"

if [[ ! -d "$BACKEND_DIR" ]]; then
  fail "Backend directory not found: $BACKEND_DIR"
fi

log "Running doctor checks"
cd "$ROOT_DIR"
npm run doctor

if [[ ! -f "$PM2_ENTRY" ]]; then
  log "Local pm2 missing, installing dev dependency"
  npm install --save-dev pm2
fi

if [[ ! -f "$PM2_ENTRY" ]]; then
  fail "Local PM2 still not found after install"
fi

log "Building backend"
npm --prefix "$BACKEND_DIR" run build

if [[ ! -f "$BACKEND_DIR/dist/app.js" ]]; then
  fail "Backend build output missing: mood-health-server/dist/app.js"
fi

# Keep behavior consistent with Windows startup script for Python .env decoding
export PYTHONUTF8=1

log "Starting/restarting services with PM2"
cd "$BACKEND_DIR"
node "$PM2_ENTRY" startOrRestart "$BACKEND_DIR/ecosystem.config.js" --update-env

log "Saving PM2 process list"
node "$PM2_ENTRY" save

log "PM2 status"
node "$PM2_ENTRY" status

log "Startup completed"
