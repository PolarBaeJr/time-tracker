# Raspberry Pi Deployment Guide

This guide walks through deploying WorkTracker as a Docker container on a Raspberry Pi that already has other applications running. The app runs in its own container on a dedicated port and does not interfere with other services.

---

## Overview

- WorkTracker runs as a Docker container serving the Expo web build via Nginx
- It listens on a port you choose (default: `3000`) — not port 80, so it coexists with other apps
- Supabase is cloud-hosted (supabase.com) — no local database to manage
- Optional: put a reverse proxy (Nginx or Caddy) in front to serve on a domain with HTTPS

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Raspberry Pi 4 or 5 | 4 GB RAM recommended. 2 GB works but may be slow during builds. |
| Raspberry Pi OS 64-bit | Lite or Desktop. Must be 64-bit (`aarch64`) for the Docker image. |
| SSH access | Everything is done over SSH. |
| Internet access | To pull Docker images and reach Supabase. |
| A Supabase project | Created at [supabase.com](https://supabase.com). Free tier is fine. |

---

## Step 1 — First-time Pi setup

Skip this step if Docker is already installed on your Pi.

**1.1 Update the system**

```bash
sudo apt-get update && sudo apt-get full-upgrade -y
sudo reboot
```

**1.2 Install Docker**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker version
```

**1.3 Install Docker Compose plugin**

```bash
sudo apt-get install -y docker-compose-plugin
docker compose version
```

**1.4 Open the firewall port**

Replace `3000` with whatever port you choose.

```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

---

## Step 2 — Clone the repository

```bash
sudo mkdir -p /opt/worktracker
sudo chown $USER:$USER /opt/worktracker
git clone https://github.com/PolarBaeJr/time-tracker /opt/worktracker
cd /opt/worktracker
```

---

## Step 3 — Configure environment variables

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```env
# Required — find these in Supabase → Settings → API
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Port WorkTracker listens on — change if 3000 is already taken
WORKTRACKER_HTTP_PORT=3000

# Docker image settings (keep these as-is for Pi)
WORKTRACKER_IMAGE=worktracker-web:latest
WORKTRACKER_DOCKER_PLATFORM=linux/arm64

# Log rotation
DOCKER_LOG_MAX_SIZE=10m
DOCKER_LOG_MAX_FILES=3
```

---

## Step 4 — Build and start the container

```bash
cd /opt/worktracker
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Expected output:

```
NAME               STATUS          PORTS
worktracker-web-1  Up (healthy)    0.0.0.0:3000->80/tcp
```

Verify it's running:

```bash
curl http://localhost:3000/health
# → OK
```

Open `http://<pi-ip>:3000` in your browser.

---

## Step 5 — Configure Google OAuth

In your Supabase project:

1. Go to **Authentication → Providers → Google** and enable it
2. Add your Pi's URL as an allowed redirect URL:
   - Local only: `http://<pi-ip>:3000`
   - With domain: `https://worktracker.yourdomain.com`
3. Go to **Authentication → URL Configuration** and add the same URL to **Redirect URLs**
4. Follow [Supabase's Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google) to create a Google OAuth client and paste the credentials into Supabase

---

## Step 6 — (Optional) Reverse proxy with domain + HTTPS

If you want to access the app via a domain name with HTTPS, put a reverse proxy in front. Pick whichever matches your existing setup:

### Option A: Host-level Nginx (already installed on the Pi)

```bash
sudo nano /etc/nginx/sites-available/worktracker
```

```nginx
server {
    listen 80;
    server_name worktracker.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/worktracker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# Add HTTPS:
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d worktracker.yourdomain.com
```

### Option B: Caddy (easiest — handles HTTPS automatically)

```bash
# Install Caddy
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

Add a block to `/etc/caddy/Caddyfile`:

```
worktracker.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
# Caddy provisions SSL automatically — nothing else needed
```

### Option C: No domain, local network only

Skip this step. Access the app at `http://<pi-ip>:3000` on your local network.

---

## Step 7 — Auto-start on reboot

Install the systemd service so the container restarts automatically when the Pi reboots:

```bash
# Patch the service file to use your actual user and path
sed -i "s|User=pi|User=$USER|g" /opt/worktracker/scripts/systemd/worktracker.service
sed -i "s|Group=pi|Group=$USER|g" /opt/worktracker/scripts/systemd/worktracker.service
sed -i "s|/opt/worktracker/worktracker|/opt/worktracker|g" /opt/worktracker/scripts/systemd/worktracker.service

sudo cp /opt/worktracker/scripts/systemd/worktracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable worktracker.service
sudo systemctl start worktracker.service
sudo systemctl status worktracker.service
```

---

## Updating to a newer version

```bash
cd /opt/worktracker
./scripts/deploy.sh
```

The deploy script pulls the latest code, rebuilds the image, and restarts the container.

---

## Useful commands

```bash
# Logs (live)
docker compose -f docker-compose.prod.yml logs -f web

# Container status
docker compose -f docker-compose.prod.yml ps

# Stop
docker compose -f docker-compose.prod.yml down

# Restart
docker compose -f docker-compose.prod.yml restart web

# Shell into container
docker compose -f docker-compose.prod.yml exec web sh

# Free up disk (removes old images)
docker image prune -a
```

---

## Troubleshooting

**Port already in use**
```bash
sudo lsof -i :3000
# Change WORKTRACKER_HTTP_PORT in .env to a free port, then restart
```

**Container is unhealthy**
```bash
docker compose -f docker-compose.prod.yml logs web
docker compose -f docker-compose.prod.yml exec web wget -qO- http://127.0.0.1:80/health
```

**Build fails — out of memory**
```bash
free -h
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
# Retry the build
```

**Wrong architecture (32-bit OS)**
```bash
uname -m   # must print aarch64, not armv7l
# If armv7l: re-flash with Raspberry Pi OS 64-bit Lite
```

**Google OAuth redirect fails**
Make sure the URL in your browser (including port) exactly matches what's added to Supabase under **Authentication → URL Configuration → Redirect URLs**.

**`deploy.sh` refuses to run**
```bash
git status      # check for local changes
git stash       # stash them, then retry
./scripts/deploy.sh
```
