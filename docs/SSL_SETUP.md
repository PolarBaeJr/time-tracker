# SSL Setup

HTTPS options for WorkTracker on Raspberry Pi.

---

## Option 1: Host-level Nginx + Certbot (recommended if Nginx is already on the Pi)

This keeps SSL termination outside the Docker container — the container just serves HTTP on its internal port, and Nginx proxies it.

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get a certificate for your domain
sudo certbot --nginx -d worktracker.yourdomain.com

# Auto-renewal is set up automatically by Certbot
# Test it:
sudo certbot renew --dry-run
```

Your Nginx site config (see `RASPBERRY_PI_DEPLOYMENT.md` Step 6) will be updated by Certbot to add the HTTPS block automatically.

---

## Option 2: Caddy (easiest)

Caddy handles certificate provisioning and renewal with zero config. See `RASPBERRY_PI_DEPLOYMENT.md` Step 6, Option B.

---

## Option 3: SSL inside the Docker container

The app ships an Nginx SSL config template at `nginx/ssl.conf`. To use it:

**3.1 Get certificates**

With a domain and Let's Encrypt:

```bash
./scripts/setup-ssl.sh yourdomain.com you@example.com
```

For local/self-signed testing only:

```bash
./scripts/setup-ssl-selfsigned.sh localhost
```

Both scripts write certificates to `certs/`:
- `certs/fullchain.pem`
- `certs/privkey.pem`
- `certs/dhparam.pem`

**3.2 Enable the SSL Nginx config**

Replace the HTTP-only nginx config with the SSL template:

```bash
cp nginx/ssl.conf nginx/nginx.conf
```

**3.3 Update `docker-compose.prod.yml`**

Add port `443` and mount the certificates:

```yaml
services:
  web:
    ports:
      - "${WORKTRACKER_HTTP_PORT:-3000}:80"
      - "443:443"
    volumes:
      - nginx_logs:/var/log/nginx
      - ./certs:/etc/nginx/certs:ro
      - /var/www/certbot:/var/www/certbot:ro
```

**3.4 Rebuild and restart**

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

**3.5 Certificate renewal**

The `setup-ssl.sh` script installs a cron job that renews automatically. To renew manually:

```bash
sudo certbot renew
# Then sync renewed certs to the certs/ directory:
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/fullchain.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/privkey.pem
docker compose -f docker-compose.prod.yml restart web
```

---

## Recommendation

If you already have Nginx or Caddy managing other apps on the Pi, use **Option 1 or 2** — it fits naturally into your existing setup. Only use Option 3 if you want a fully self-contained container with no host-level proxy.
