#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/mood_health_server/.env"
ENV_TEMPLATE="$SCRIPT_DIR/mood_health_server/.env.production.no-ai.example"
LOCAL_FRONTEND_URLS="http://127.0.0.1:4173,http://127.0.0.1:3001,http://localhost:4173,http://localhost:3001"
SQLITE_DB_PATH="$SCRIPT_DIR/mood_health_server/data/mood-health.db"

cd "$SCRIPT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_TEMPLATE" ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    echo "[deploy] Created mood_health_server/.env from .env.production.no-ai.example"
  else
    echo "[deploy] Missing template: $ENV_TEMPLATE"
    exit 1
  fi
fi

generate_hex_secret() {
  node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
}

set_env_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env_value "NODE_ENV" "production"
set_env_value "PORT" "3000"
set_env_value "HOST" "127.0.0.1"
set_env_value "DB_CLIENT" "sqlite"
set_env_value "SQLITE_DB_PATH" "$SQLITE_DB_PATH"
set_env_value "AI_ENABLED" "false"
set_env_value "FRONTEND_URL" "$LOCAL_FRONTEND_URLS"

if ! grep -q '^JWT_SECRET=' "$ENV_FILE" || grep -q '^JWT_SECRET=replace_with_a_strong_random_secret$' "$ENV_FILE"; then
  set_env_value "JWT_SECRET" "$(generate_hex_secret)"
  echo "[deploy] Generated JWT_SECRET"
fi

if ! grep -q '^ENCRYPTION_KEY=' "$ENV_FILE" || grep -q '^ENCRYPTION_KEY=replace_with_64_hex_chars$' "$ENV_FILE"; then
  set_env_value "ENCRYPTION_KEY" "$(generate_hex_secret)"
  echo "[deploy] Generated ENCRYPTION_KEY"
fi

echo "[deploy] Installing dependencies"
npm run setup

echo "[deploy] Building frontend and backend"
npm run build:all

echo "[deploy] Starting backend via PM2"
bash ./start-project.sh --no-ai

echo "[deploy] Checking local health endpoint"
curl -fsS http://127.0.0.1:3000/health
echo
echo "[deploy] First deployment finished"