#!/usr/bin/env bash
set -euo pipefail

clean=false
ai_enabled=""

for arg in "$@"; do
  case "$arg" in
    --clean)
      clean=true
      ;;
    --no-ai)
      ai_enabled="false"
      ;;
    --with-ai)
      ai_enabled="true"
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

if [[ -n "$ai_enabled" ]]; then
  export AI_ENABLED="$ai_enabled"
  echo "[start-project] AI_ENABLED=$AI_ENABLED"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_BIN="$SCRIPT_DIR/node_modules/pm2/bin/pm2"
ECOSYSTEM_FILE="$SCRIPT_DIR/mood_health_server/ecosystem.config.js"
DIST_APP="$SCRIPT_DIR/mood_health_server/dist/app.js"
ENV_FILE="$SCRIPT_DIR/mood_health_server/.env"
ENV_TEMPLATE_NO_AI="$SCRIPT_DIR/mood_health_server/.env.production.no-ai.example"
ENV_TEMPLATE="$SCRIPT_DIR/mood_health_server/.env.example"

if [[ ! -f "$PM2_BIN" ]]; then
  echo "PM2 not found at $PM2_BIN. Run npm install in repository root first."
  exit 1
fi

if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
  echo "Ecosystem file missing: $ECOSYSTEM_FILE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file missing: $ENV_FILE"
  if [[ -f "$ENV_TEMPLATE_NO_AI" ]]; then
    echo "Create it with: cp mood_health_server/.env.production.no-ai.example mood_health_server/.env"
  elif [[ -f "$ENV_TEMPLATE" ]]; then
    echo "Create it with: cp mood_health_server/.env.example mood_health_server/.env"
  else
    echo "No environment template found in mood_health_server/"
  fi
  exit 1
fi

cd "$SCRIPT_DIR"

if [[ "$clean" == true ]]; then
  node "$PM2_BIN" delete mood-health-server >/dev/null 2>&1 || true
fi

if [[ ! -f "$DIST_APP" ]]; then
  echo "[start-project] dist/app.js missing, building backend..."
  npm --prefix mood_health_server run build
fi

node "$PM2_BIN" delete mood-health-server >/dev/null 2>&1 || true
node "$PM2_BIN" start "$ECOSYSTEM_FILE" --only mood-health-server --update-env

node "$PM2_BIN" save >/dev/null
node "$PM2_BIN" status
