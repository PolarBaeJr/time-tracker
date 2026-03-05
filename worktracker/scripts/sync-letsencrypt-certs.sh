#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <domain>"
  exit 1
fi

DOMAIN="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$PROJECT_ROOT/certs"
LIVE_DIR="/etc/letsencrypt/live/$DOMAIN"

if [[ ! -f "$LIVE_DIR/fullchain.pem" || ! -f "$LIVE_DIR/privkey.pem" ]]; then
  echo "Could not find Let's Encrypt files for domain: $DOMAIN"
  echo "Expected: $LIVE_DIR/fullchain.pem and $LIVE_DIR/privkey.pem"
  exit 1
fi

mkdir -p "$CERT_DIR"

install -D -m 0644 "$LIVE_DIR/fullchain.pem" "$CERT_DIR/fullchain.pem"
install -D -m 0600 "$LIVE_DIR/privkey.pem" "$CERT_DIR/privkey.pem"

if [[ ! -f "$CERT_DIR/dhparam.pem" ]]; then
  echo "Generating 2048-bit Diffie-Hellman parameters. This can take a while."
  openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048
  chmod 0644 "$CERT_DIR/dhparam.pem"
fi

echo "Synced certificates into $CERT_DIR"
