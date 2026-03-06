# Docker Usage

WorkTracker ships a production-oriented web image in [`Dockerfile`](../Dockerfile) plus two Compose entry points:

- [`docker-compose.yml`](../docker-compose.yml) for local containerized development.
- [`docker-compose.prod.yml`](../docker-compose.prod.yml) for long-running deployments.

Both files build the Expo web export and serve it through Nginx on container port `80`.

## Prerequisites

1. Install Docker Desktop or Docker Engine with Compose v2.
2. Copy `.env.example` to `.env`.
3. Fill in at least `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

Optional but supported in the Compose build args:

- `GOOGLE_IOS_REVERSED_CLIENT_ID`
- `EAS_PROJECT_ID`
- `WORKTRACKER_WEB_PORT`
- `WORKTRACKER_HTTP_PORT`
- `WORKTRACKER_IMAGE`
- `WORKTRACKER_DOCKER_PLATFORM`

## Local development

Build and start the web container:

```bash
docker compose up --build -d
```

Then open `http://localhost:3000` unless you changed `WORKTRACKER_WEB_PORT`.

Useful commands:

```bash
docker compose logs -f web
docker compose ps
docker compose down
```

Rebuild after code or dependency changes:

```bash
docker compose build web
docker compose up -d web
```

## Optional Supabase profile

The base Compose file includes a disabled `supabase` profile for offline-only smoke testing:

```bash
docker compose --profile supabase up -d supabase
```

Notes:

- The profile uses the `supabase/supabase` image as a lightweight local backend placeholder.
- If you need full local parity with the checked-in [`supabase/config.toml`](../supabase/config.toml), keep this profile disabled and use `supabase start` instead.

## Production deployment

Use the production file for deployments that should restart automatically and rotate JSON logs:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Operational commands:

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml down
```

The production service:

- Publishes container port `80` to `WORKTRACKER_HTTP_PORT` (defaults to `80`).
- Restarts with `unless-stopped`.
- Writes Nginx logs to the named `nginx_logs` volume.
- Checks `/health` inside the container before reporting healthy.

## Health checks and logs

The Compose health checks target `http://127.0.0.1:80/health`. They use `wget` rather than `curl` because the current `nginx:alpine` runtime image includes BusyBox tooling but not `curl` by default.

Log rotation is controlled with:

```env
DOCKER_LOG_MAX_SIZE=10m
DOCKER_LOG_MAX_FILES=3
```
