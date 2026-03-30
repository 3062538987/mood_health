#!/usr/bin/env bash
set -euo pipefail

clean=false

for arg in "$@"; do
  case "$arg" in
    --clean)
      clean=true
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_BIN="$SCRIPT_DIR/node_modules/pm2/bin/pm2"
ECOSYSTEM_FILE="$SCRIPT_DIR/mood-health-server/ecosystem.config.js"
DIST_APP="$SCRIPT_DIR/mood-health-server/dist/app.js"

if [[ ! -f "$PM2_BIN" ]]; then
  echo "PM2 not found at $PM2_BIN. Run npm install in repository root first."
  exit 1
fi

if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
  echo "Ecosystem file missing: $ECOSYSTEM_FILE"
  exit 1
fi

cd "$SCRIPT_DIR"

if [[ "$clean" == true ]]; then
  node "$PM2_BIN" delete mood-health-server >/dev/null 2>&1 || true
fi

if [[ ! -f "$DIST_APP" ]]; then
  echo "[start-project] dist/app.js missing, building backend..."
  npm --prefix mood-health-server run build
fi

node "$PM2_BIN" delete mood-health-server >/dev/null 2>&1 || true
node "$PM2_BIN" start "$ECOSYSTEM_FILE" --only mood-health-server --update-env

node "$PM2_BIN" save >/dev/null
node "$PM2_BIN" status
