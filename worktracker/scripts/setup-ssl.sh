#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <domain> <email> [acme-webroot]"
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"
ACME_WEBROOT="${3:-/var/www/certbot}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNC_SCRIPT="$PROJECT_ROOT/scripts/sync-letsencrypt-certs.sh"
CRON_FILE="/etc/cron.d/worktracker-certbot-renew"
DEPLOY_HOOK="bash '$SYNC_SCRIPT' '$DOMAIN'"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script currently supports Debian, Ubuntu, and Raspberry Pi OS."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y openssl snapd
sudo systemctl enable --now snapd.socket >/dev/null 2>&1 || true

if command -v snap >/dev/null 2>&1; then
  sudo snap install core >/dev/null 2>&1 || true
  sudo snap refresh core >/dev/null 2>&1 || true

  if ! snap list certbot >/dev/null 2>&1; then
    sudo snap install --classic certbot
  fi

  sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
fi

if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get install -y certbot
fi

sudo mkdir -p "$ACME_WEBROOT"

sudo certbot certonly \
  --webroot \
  -w "$ACME_WEBROOT" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring

sudo bash "$SYNC_SCRIPT" "$DOMAIN"

sudo tee "$CRON_FILE" >/dev/null <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
23 3 * * * root certbot renew --quiet --deploy-hook "$DEPLOY_HOOK"
EOF

sudo chmod 0644 "$CRON_FILE"
sudo certbot renew --dry-run --deploy-hook "$DEPLOY_HOOK"

echo "Let's Encrypt certificates are ready."
echo "Synced files:"
echo "  $PROJECT_ROOT/certs/fullchain.pem"
echo "  $PROJECT_ROOT/certs/privkey.pem"
echo "  $PROJECT_ROOT/certs/dhparam.pem"
echo
echo "Next steps:"
echo "  1. Mount $ACME_WEBROOT to /var/www/certbot in your nginx container."
echo "  2. Mount $PROJECT_ROOT/certs to /etc/nginx/certs:ro."
echo "  3. Replace the HTTP-only server block in nginx/nginx.conf with nginx/ssl.conf."
