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

---

## Self-hosted Supabase on Raspberry Pi 5

This section covers running the entire Supabase stack locally on a Pi 5 (16 GB RAM, 2 TB SSD). In this setup the Pi is your database server — no supabase.com account needed.

### Hardware assumptions

| Component | Spec |
|-----------|------|
| Board | Raspberry Pi 5 |
| RAM | 16 GB |
| Storage | 2 TB SSD (connected via USB 3 or PCIe HAT) |
| OS | Raspberry Pi OS 64-bit Lite (`aarch64`) |

### Overview of what runs

Supabase self-host spins up ~13 containers:

| Container | Purpose |
|-----------|---------|
| `db` | PostgreSQL 15 |
| `auth` (GoTrue) | Authentication |
| `rest` (PostgREST) | Auto-generated REST API |
| `realtime` | WebSocket subscriptions |
| `storage` | File storage |
| `imgproxy` | Image transformations |
| `edge-runtime` | Supabase Edge Functions |
| `kong` | API gateway (port 8000) |
| `studio` | Supabase dashboard UI (port 3001) |
| `meta` | Postgres metadata API |
| `functions` | Custom Edge Functions |
| `analytics` | Logflare analytics |
| `vector` | Log aggregation |

---

### Step A — Mount and prepare the SSD

```bash
# Find the SSD device name
lsblk

# Format (if new — DESTRUCTIVE, skip if already formatted)
sudo mkfs.ext4 /dev/sda1

# Create mount point and mount
sudo mkdir -p /mnt/ssd
sudo mount /dev/sda1 /mnt/ssd

# Make it auto-mount on reboot
echo "UUID=$(sudo blkid -s UUID -o value /dev/sda1) /mnt/ssd ext4 defaults,noatime 0 2" | sudo tee -a /etc/fstab

# Create data directories on the SSD
sudo mkdir -p /mnt/ssd/supabase/postgres
sudo mkdir -p /mnt/ssd/supabase/storage
sudo chown -R $USER:$USER /mnt/ssd/supabase
```

---

### Step B — Install Docker (skip if already installed)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt-get install -y docker-compose-plugin
docker compose version   # should print v2.x
```

---

### Step C — Clone Supabase and configure

```bash
git clone --depth 1 https://github.com/supabase/supabase /opt/supabase
cd /opt/supabase/docker
cp .env.example .env
```

Edit `.env`:

```bash
nano .env
```

Set these values (generate secrets with `openssl rand -base64 32`):

```env
############################################################
# REQUIRED — generate these, do not leave as defaults
############################################################

# Postgres password — pick something strong
POSTGRES_PASSWORD=your_strong_password_here

# JWT secrets — must be at least 32 chars
JWT_SECRET=your_jwt_secret_here
ANON_KEY=your_anon_key_here          # generate with: node -e "require('jsonwebtoken').sign({role:'anon'},process.env.JWT_SECRET,{expiresIn:'10y'},(_,t)=>console.log(t))"
SERVICE_ROLE_KEY=your_service_role_key_here

############################################################
# URLs — replace <pi-ip> with your Pi's LAN IP
############################################################

SITE_URL=http://<pi-ip>:8000
API_EXTERNAL_URL=http://<pi-ip>:8000
SUPABASE_PUBLIC_URL=http://<pi-ip>:8000

# Studio dashboard URL
STUDIO_DEFAULT_ORGANIZATION=WorkTracker
STUDIO_DEFAULT_PROJECT=worktracker

############################################################
# Google OAuth (copy from your existing Supabase project)
############################################################

GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your_google_client_id
GOTRUE_EXTERNAL_GOOGLE_SECRET=your_google_client_secret
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=http://<pi-ip>:8000/auth/v1/callback

############################################################
# Email (for workspace invites — optional, add later)
############################################################

SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=your_resend_api_key
SMTP_SENDER_NAME=WorkTracker
```

Point Postgres data at the SSD by editing `docker-compose.yml`:

```bash
# Replace the db volume path with your SSD mount
sed -i 's|./volumes/db/data:|/mnt/ssd/supabase/postgres:|g' docker-compose.yml
sed -i 's|./volumes/storage:|/mnt/ssd/supabase/storage:|g' docker-compose.yml
```

---

### Step D — Pull images and start

The first pull will take several minutes on Pi (large images):

```bash
cd /opt/supabase/docker
docker compose pull
docker compose up -d

# Watch startup progress
docker compose logs -f --tail=50
```

Once all containers are healthy:

```bash
docker compose ps   # all should show "healthy" or "running"
```

Verify the API gateway is responding:

```bash
curl http://localhost:8000/rest/v1/   # should return JSON
```

Open the Studio dashboard in your browser:
```
http://<pi-ip>:3001
```

---

### Step E — Apply WorkTracker migrations

With your local Supabase running, apply all migrations:

```bash
cd /Users/matthewcheng/Projects/Time\ tracker

# Set the local DB URL (password from .env POSTGRES_PASSWORD)
export SUPABASE_DB_URL="postgresql://postgres:your_strong_password_here@<pi-ip>:5432/postgres"

npx supabase db push --db-url "$SUPABASE_DB_URL"
```

All 34 migrations will be applied to the local Postgres instance.

---

### Step F — Deploy Edge Functions

```bash
cd /Users/matthewcheng/Projects/Time\ tracker

# Link to the local instance
npx supabase link --project-ref worktracker --supabase-url http://<pi-ip>:8000 --supabase-key your_service_role_key_here

# Deploy all Edge Functions
npx supabase functions deploy send-workspace-invite
npx supabase functions deploy shared-dashboard
npx supabase functions deploy public-profile
npx supabase functions deploy decrypt-api-key
npx supabase functions deploy encrypt-api-key
npx supabase functions deploy email-sync
npx supabase functions deploy calendar-sync
```

Set Edge Function secrets (for workspace invite emails):

```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key
```

---

### Step G — Point the WorkTracker app at the Pi

Update your local `.env` (or app config):

```env
EXPO_PUBLIC_SUPABASE_URL=http://<pi-ip>:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Update Google OAuth in Google Cloud Console — add `http://<pi-ip>:8000/auth/v1/callback` as an authorised redirect URI.

---

### Step H — Auto-start Supabase on reboot

```bash
sudo tee /etc/systemd/system/supabase.service > /dev/null <<EOF
[Unit]
Description=Supabase self-hosted
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/supabase/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable supabase.service
sudo systemctl start supabase.service
```

---

### Generating ANON_KEY and SERVICE_ROLE_KEY

Use this script on any machine with Node.js to generate keys from your `JWT_SECRET`:

```bash
node -e "
const jwt = require('jsonwebtoken');
const secret = 'your_jwt_secret_here';
const anon = jwt.sign({ role: 'anon' }, secret, { expiresIn: '10y' });
const service = jwt.sign({ role: 'service_role' }, secret, { expiresIn: '10y' });
console.log('ANON_KEY=' + anon);
console.log('SERVICE_ROLE_KEY=' + service);
"
```

---

### Useful commands

```bash
# Status of all Supabase containers
docker compose -f /opt/supabase/docker/docker-compose.yml ps

# Live logs for a specific service
docker compose -f /opt/supabase/docker/docker-compose.yml logs -f db
docker compose -f /opt/supabase/docker/docker-compose.yml logs -f auth

# Restart a single service
docker compose -f /opt/supabase/docker/docker-compose.yml restart realtime

# Connect directly to Postgres
psql postgresql://postgres:your_password@localhost:5432/postgres

# Disk usage
df -h /mnt/ssd
du -sh /mnt/ssd/supabase/postgres
```

### Updating Supabase

```bash
cd /opt/supabase
git pull
cd docker
docker compose pull
docker compose up -d --remove-orphans
```

### Self-hosted Supabase troubleshooting

**Studio shows blank / can't connect**
```bash
# Check Kong gateway
docker compose logs kong | tail -20
# Verify SITE_URL in .env matches the URL you're browsing from
```

**Auth / Google OAuth not working**
```bash
docker compose logs auth | tail -30
# Confirm GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI exactly matches the
# authorised redirect URI in Google Cloud Console
```

**Realtime subscriptions not connecting**
```bash
docker compose logs realtime | tail -20
# Ensure port 4000 is not blocked by firewall:
sudo ufw allow 4000/tcp
```

**Edge Functions not responding**
```bash
docker compose logs edge-runtime | tail -20
# Redeploy:
npx supabase functions deploy <function-name>
```

**Postgres running out of connections**
```bash
# Edit /opt/supabase/docker/volumes/db/postgresql.conf
# Increase: max_connections = 200
docker compose restart db
```
