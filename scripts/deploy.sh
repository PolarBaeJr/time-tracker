#!/usr/bin/env bash
# deploy.sh — Pull latest code, rebuild Docker image, and restart WorkTracker
# Usage: ./scripts/deploy.sh
#
# Safety model:
#   - Fetches new code into a temp branch first
#   - Builds the image BEFORE switching to new code
#   - Only fast-forwards HEAD after a successful build
#   - On any failure the running container is never touched

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"

cd "$PROJECT_DIR"

# ── 1. Guard against uncommitted changes ─────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Uncommitted local changes detected. Stash or commit them first."
  echo "       Run: git stash"
  exit 1
fi

# ── 2. Load .env (for SUPABASE_URL etc.) ─────────────────────────────────────
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

# ── 3. Fetch latest without applying yet ─────────────────────────────────────
echo "→ Fetching latest code..."
git fetch origin

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE_REF="origin/${CURRENT_BRANCH}"

if git merge-base --is-ancestor "$REMOTE_REF" HEAD; then
  echo "  Already up to date — nothing to pull."
fi

# Check out the new code into a temporary worktree so the build can be tested
# without disturbing the working tree the current container was built from.
WORKTREE_DIR="$(mktemp -d)"
trap 'git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true; rm -rf "$WORKTREE_DIR"' EXIT

git worktree add --detach "$WORKTREE_DIR" "$REMOTE_REF"

# ── 4. Build image from new code ─────────────────────────────────────────────
echo "→ Building Docker image from new code..."
docker build \
  --pull \
  --tag worktracker-web:candidate \
  --build-arg SUPABASE_URL="${SUPABASE_URL:-}" \
  --build-arg SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}" \
  --build-arg GOOGLE_IOS_REVERSED_CLIENT_ID="${GOOGLE_IOS_REVERSED_CLIENT_ID:-}" \
  --build-arg EAS_PROJECT_ID="${EAS_PROJECT_ID:-}" \
  "$WORKTREE_DIR"

# ── 5. Build succeeded — now fast-forward HEAD ───────────────────────────────
echo "→ Build succeeded. Fast-forwarding to new code..."
git merge --ff-only "$REMOTE_REF"

# Tag candidate as latest
docker tag worktracker-web:candidate worktracker-web:latest

# ── 6. Restart container ──────────────────────────────────────────────────────
echo "→ Restarting container..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# ── 7. Health check ───────────────────────────────────────────────────────────
echo "→ Waiting for health check..."
RETRIES=12
PORT="${WORKTRACKER_HTTP_PORT:-80}"
for i in $(seq 1 $RETRIES); do
  if wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "✓ App is healthy at http://127.0.0.1:${PORT}"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "ERROR: Health check failed after ${RETRIES} attempts. Rolling back..."
    docker tag worktracker-web:previous worktracker-web:latest 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    docker compose -f "$COMPOSE_FILE" logs --tail=50 web
    exit 1
  fi
  echo "  Waiting... (${i}/${RETRIES})"
  sleep 5
done

# ── 8. Save previous image tag for potential rollback, prune old images ───────
docker tag worktracker-web:latest worktracker-web:previous 2>/dev/null || true
docker image prune -f

echo "✓ Deploy complete."
