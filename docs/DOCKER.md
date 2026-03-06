# Docker Usage

WorkTracker ships a production Docker image (`Dockerfile`) plus two Compose files:

- `docker-compose.yml` — local development
- `docker-compose.prod.yml` — production (Raspberry Pi or any server)

The image builds the Expo web export and serves it via Nginx on container port `80`. On the host you pick any port via `WORKTRACKER_HTTP_PORT`.

---

## Prerequisites

- Docker Engine + Compose v2 (`docker compose version` works)
- `.env` file copied from `.env.example` and filled in

---

## Local development

```bash
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_ANON_KEY

docker compose up --build -d
```

App is at `http://localhost:3000` (or `WORKTRACKER_WEB_PORT` if you changed it).

Useful commands:

```bash
docker compose logs -f web
docker compose ps
docker compose down
docker compose build web   # rebuild after code changes
docker compose up -d web   # restart after rebuild
```

---

## Production

```bash
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f web
```

The production service:
- Publishes on `WORKTRACKER_HTTP_PORT` (default `3000` — change in `.env` to avoid conflicts with other apps)
- Restarts automatically with `unless-stopped`
- Rotates logs via `DOCKER_LOG_MAX_SIZE` / `DOCKER_LOG_MAX_FILES`
- Reports healthy when `GET /health` returns `200`

---

## Environment variables

All configuration lives in `.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anon key |
| `WORKTRACKER_HTTP_PORT` | No | `3000` | Host port to expose the app on |
| `WORKTRACKER_IMAGE` | No | `worktracker-web:latest` | Docker image tag |
| `WORKTRACKER_DOCKER_PLATFORM` | No | `linux/arm64` | Target platform (use `linux/amd64` on x86) |
| `DOCKER_LOG_MAX_SIZE` | No | `10m` | Max size per log file |
| `DOCKER_LOG_MAX_FILES` | No | `3` | Number of log files to keep |

---

## Choosing the right port

If you have other apps on the Pi, pick a port that isn't in use:

```bash
sudo lsof -i -P -n | grep LISTEN   # see all used ports
```

Set your chosen port in `.env`:

```env
WORKTRACKER_HTTP_PORT=3001
```

Then rebuild and restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Health checks

The health endpoint is `GET /health` and returns `200 OK`. It is checked every 30 seconds inside the container. Check it manually:

```bash
curl http://localhost:3000/health
# or from inside the container:
docker compose -f docker-compose.prod.yml exec web wget -qO- http://127.0.0.1:80/health
```

---

## Building for a different architecture

The Dockerfile uses `--platform=$BUILDPLATFORM` for the build stage and `--platform=$TARGETPLATFORM` for the runtime stage. To build an arm64 image from an x86 machine:

```bash
docker buildx build --platform linux/arm64 -t worktracker-web:latest .
```

On the Pi itself, `linux/arm64` is native so a plain `docker compose build` works fine.
