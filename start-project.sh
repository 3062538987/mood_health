#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2="$ROOT/node_modules/pm2/bin/pm2"
WITH_AI=true

for argument in "$@"; do
  case "$argument" in
    --no-ai) WITH_AI=false ;;
    --with-ai) WITH_AI=true ;;
    *) echo "Unknown argument: $argument" >&2; exit 2 ;;
  esac
done

cd "$ROOT"
if [[ ! -f "$PM2" ]]; then
  echo "PM2 is missing. Run npm install first." >&2
  exit 1
fi

npm --prefix mood_health_server run build
test -f "$ROOT/mood_health_server/dist/server.js"

node "$PM2" delete mood-health-server >/dev/null 2>&1 || true
node "$PM2" start "$ROOT/mood_health_server/ecosystem.config.js" \
  --only mood-health-server --update-env

if [[ "$WITH_AI" == true ]]; then
  AI_PYTHON="$ROOT/mood_health_ai_service/.venv/bin/python"
  if [[ ! -x "$AI_PYTHON" ]]; then
    echo "Python 3.11 environment is missing. Create mood_health_ai_service/.venv first." >&2
    exit 1
  fi
  AI_VERSION="$($AI_PYTHON -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  if [[ "$AI_VERSION" != "3.11" ]]; then
    echo "AI service requires Python 3.11; found $AI_VERSION." >&2
    exit 1
  fi
  node "$PM2" delete mood-ai-server >/dev/null 2>&1 || true
  node "$PM2" start "$AI_PYTHON" --name mood-ai-server -- \
    -m uvicorn app.main:app --app-dir "$ROOT/mood_health_ai_service" --host 127.0.0.1 --port 8001
fi

node "$PM2" save
echo "Mood Health backend services started."
