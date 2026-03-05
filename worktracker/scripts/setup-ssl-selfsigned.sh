#!/usr/bin/env bash

set -euo pipefail

COMMON_NAME="${1:-localhost}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$PROJECT_ROOT/certs"

mkdir -p "$CERT_DIR"

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -sha256 \
  -days 365 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=$COMMON_NAME" \
  -addext "subjectAltName=DNS:$COMMON_NAME,DNS:localhost,IP:127.0.0.1"

if [[ ! -f "$CERT_DIR/dhparam.pem" ]]; then
  echo "Generating 2048-bit Diffie-Hellman parameters. This can take a while."
  openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048
fi

chmod 0600 "$CERT_DIR/privkey.pem"
chmod 0644 "$CERT_DIR/fullchain.pem" "$CERT_DIR/dhparam.pem"

echo "Self-signed certificates written to $CERT_DIR"
echo "Mount $CERT_DIR to /etc/nginx/certs:ro before promoting nginx/ssl.conf."
