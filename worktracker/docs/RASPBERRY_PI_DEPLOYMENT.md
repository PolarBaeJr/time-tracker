# Raspberry Pi Deployment

This guide deploys the Expo web export on a Raspberry Pi using the checked-in Docker, Compose, nginx, and SSL artifacts. The current production Compose file is HTTP-first on port `80`; if you also want container-managed TLS, layer in the certificate mounts described in [`SSL_SETUP.md`](./SSL_SETUP.md).

## 1. Flash Raspberry Pi OS 64-bit

1. Use Raspberry Pi Imager and choose `Raspberry Pi OS Lite (64-bit)` unless you need a desktop.
2. In the imager advanced settings:
   - Set a hostname such as `worktracker-pi`
   - Enable SSH
   - Preconfigure your Wi-Fi or Ethernet settings
   - Create a non-default password
3. Boot the Pi and log in over SSH.

## 2. Initial host setup

Update the system and set a stable hostname:

```bash
sudo apt-get update
sudo apt-get full-upgrade -y
sudo hostnamectl set-hostname worktracker-pi
sudo reboot
```

After the reboot, reconnect and install common admin tools:

```bash
sudo apt-get update
sudo apt-get install -y git ufw
```

## 3. Install Docker Engine

The project brief uses Docker's convenience script:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Docker's documentation notes that the convenience script is useful for fast provisioning, but the repository-based install gives you tighter control over production upgrades. If you need stricter version pinning, switch to Docker's Debian/Raspberry Pi OS repository flow instead of the script.

Add your deployment user to the Docker group and verify the engine:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
docker version
```

## 4. Install Docker Compose

If `docker compose version` already works, keep that plugin. If not, install it explicitly:

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
docker compose version
```

## 5. Configure the firewall

Allow SSH and web traffic before enabling UFW:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

## 6. Clone the repository

Use a path without spaces so systemd units stay simple:

```bash
sudo mkdir -p /opt/worktracker
sudo chown "$USER":"$USER" /opt/worktracker
git clone <your-repo-url> /opt/worktracker/worktracker
cd /opt/worktracker/worktracker
```

## 7. Configure environment variables

Create the production environment file from the checked-in template:

```bash
cp .env.example .env
```

At minimum, set:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
WORKTRACKER_IMAGE=worktracker-web:latest
WORKTRACKER_DOCKER_PLATFORM=linux/arm64
WORKTRACKER_HTTP_PORT=80
DOCKER_LOG_MAX_SIZE=10m
DOCKER_LOG_MAX_FILES=3
```

If you use Google OAuth or EAS-driven runtime config, also populate:

- `GOOGLE_IOS_REVERSED_CLIENT_ID`
- `EAS_PROJECT_ID`

## 8. Build and start the containers

Deploy with the checked-in production compose file:

```bash
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Health checks target `http://127.0.0.1:80/health` inside the container. Review startup logs with:

```bash
docker compose -f docker-compose.prod.yml logs -f web
```

## 9. Optional HTTPS on the Pi

The checked-in `docker-compose.prod.yml` does not yet expose `443` or mount certificates. If you want nginx inside the container to terminate TLS:

1. Follow [`SSL_SETUP.md`](./SSL_SETUP.md) to create `certs/fullchain.pem`, `certs/privkey.pem`, and `certs/dhparam.pem`.
2. Extend your production compose setup to publish `443:443`.
3. Add these mounts to the `web` service:

```yaml
volumes:
  - ./certs:/etc/nginx/certs:ro
  - /var/www/certbot:/var/www/certbot:ro
```

4. Promote `nginx/ssl.conf` into `nginx/nginx.conf` before rebuilding the image.

## 10. Automatic deployment on boot

This repository includes:

- [`scripts/deploy.sh`](../scripts/deploy.sh) to update the repo and restart the production containers
- [`scripts/systemd/worktracker.service`](../scripts/systemd/worktracker.service) as a systemd template

Install the service:

```bash
sudo cp scripts/systemd/worktracker.service /etc/systemd/system/worktracker.service
sudo systemctl daemon-reload
sudo systemctl enable worktracker.service
sudo systemctl start worktracker.service
sudo systemctl status worktracker.service
```

Before enabling it, update the unit file if your deployment user or clone path differs from:

- `User=pi`
- `Group=pi`
- `WorkingDirectory=/opt/worktracker/worktracker`
- `ExecStart=/usr/bin/env bash /opt/worktracker/worktracker/scripts/deploy.sh`

## Performance tuning

Recommended Pi tuning for smoother builds and fewer restarts:

1. Prefer Raspberry Pi 4/5 with at least 4 GB RAM.
2. Use wired Ethernet if possible.
3. Put the repo and Docker data on SSD if your Pi supports it.
4. Keep active cooling on the Pi to avoid thermal throttling during image builds.
5. Increase swap for occasional web-image rebuilds:

```bash
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

6. Reduce swappiness so swap is only used when needed:

```bash
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-worktracker.conf
sudo sysctl --system
```

7. Keep Docker logs capped with `DOCKER_LOG_MAX_SIZE` and `DOCKER_LOG_MAX_FILES` in `.env`.

## Backup strategy

This deployment stores application state primarily outside the Pi because Supabase is remote. Back up these local assets anyway:

1. `.env`
2. `certs/` if you terminate TLS on the Pi
3. Any custom compose overrides or nginx overrides you add later

A simple file backup example:

```bash
tar -czf worktracker-config-backup-$(date +%F).tar.gz .env certs scripts/systemd
```

If you later add self-hosted services with persistent Docker volumes, back those volumes up separately before upgrades.

## Troubleshooting

### `docker compose` is missing

Install the plugin:

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

### Permission denied talking to Docker

Re-run your shell after adding the user to the Docker group:

```bash
newgrp docker
docker ps
```

### The web container is unhealthy

Inspect the container and the health endpoint:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml exec web wget -qO- http://127.0.0.1:80/health
```

### Builds fail with low-memory or disk errors

Check current usage:

```bash
free -h
df -h
docker system df
```

If necessary, prune unused Docker artifacts:

```bash
docker image prune -a
docker builder prune
```

### `scripts/deploy.sh` refuses to run

The deploy script exits when the repo has local changes. Either commit/stash them or deploy from a clean checkout:

```bash
git status
```
