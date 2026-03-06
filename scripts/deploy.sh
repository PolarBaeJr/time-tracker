#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [[ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $PROJECT_ROOT/$COMPOSE_FILE"
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
  echo "Missing $PROJECT_ROOT/.env"
  echo "Copy .env.example to .env before deploying."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
fi

cd "$PROJECT_ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to deploy with uncommitted local changes."
  exit 1
fi

git pull --ff-only
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build --pull
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps
