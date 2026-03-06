# SSL Setup

WorkTracker ships a ready-to-promote HTTPS template in [`nginx/ssl.conf`](../nginx/ssl.conf), but the default runtime stays HTTP-only until certificates exist.

## Paths expected by `nginx/ssl.conf`

- Certificates: `/etc/nginx/certs/fullchain.pem`
- Private key: `/etc/nginx/certs/privkey.pem`
- Diffie-Hellman params: `/etc/nginx/certs/dhparam.pem`
- ACME challenge webroot: `/var/www/certbot`

The HTTPS template keeps `GET /health` on plain HTTP so container health checks can stay on `:80/health`, but all other HTTP requests are redirected to HTTPS. ACME challenges under `/.well-known/acme-challenge/` are also exempt from the redirect.

## Let's Encrypt

Use [`scripts/setup-ssl.sh`](../scripts/setup-ssl.sh) on a Debian, Ubuntu, or Raspberry Pi OS host:

```bash
./scripts/setup-ssl.sh yourdomain.com you@example.com
```

What the script does:

1. Installs Certbot (preferring the current snap-based flow, falling back to the distro package if needed).
2. Creates the ACME webroot at `/var/www/certbot`.
3. Runs `certbot certonly --webroot -w /var/www/certbot -d yourdomain.com`.
4. Copies the issued certificate pair into the repo-local `certs/` directory.
5. Generates `certs/dhparam.pem` if it does not exist yet.
6. Writes `/etc/cron.d/worktracker-certbot-renew` to run `certbot renew --quiet` with a deploy hook that resyncs `certs/`.
7. Runs `certbot renew --dry-run` to validate renewal.

## Self-signed certificates

For local development or air-gapped testing:

```bash
./scripts/setup-ssl-selfsigned.sh localhost
```

This writes:

- `certs/fullchain.pem`
- `certs/privkey.pem`
- `certs/dhparam.pem`

Browsers will still show a warning unless you trust the self-signed certificate locally.

## Enabling HTTPS in Docker

The checked-in Compose files currently serve the HTTP-only nginx config. Before promoting `nginx/ssl.conf`, make sure your deployment exposes port `443` and mounts both the certificate and ACME paths into the container:

```yaml
ports:
  - "80:80"
  - "443:443"
volumes:
  - ./certs:/etc/nginx/certs:ro
  - /var/www/certbot:/var/www/certbot:ro
```

Then replace the HTTP-only `server { ... }` block in [`nginx/nginx.conf`](../nginx/nginx.conf) with the two server blocks from [`nginx/ssl.conf`](../nginx/ssl.conf), rebuild the image, and restart nginx.

## TLS settings

`nginx/ssl.conf` uses TLS 1.2 and 1.3, a Mozilla-compatible intermediate cipher list, and explicit curves/session settings suitable for modern browsers while still supporting older clients than a TLS 1.3-only setup.
