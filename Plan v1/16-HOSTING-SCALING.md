# 16 - Hosting & Scaling (Raspberry Pi Self-Hosted)

## Server Specs

- **Hardware**: Raspberry Pi (ARM64)
- **RAM**: 16GB
- **Storage**: 1.8TB
- **OS**: Linux (arm64)
- **Existing**: Docker Compose with Supabase stack, nginx reverse proxy

## Architecture

```
Raspberry Pi (16GB RAM, 1.8TB SSD)
│
├── nginx (reverse proxy)
│   └── Cloudflare Tunnel (SSL, caching, DDoS protection)
│
├── Supabase Stack (Docker)
│   ├── PostgreSQL 15 (2GB shared_buffers)
│   ├── PgBouncer (connection pooler) ← NEW, mandatory
│   ├── GoTrue (Auth)
│   ├── PostgREST (API)
│   ├── Supabase Realtime
│   └── Supabase Storage
│
├── sync-worker (Node.js container) ← NEW, replaces Edge Functions
│   ├── Email sync (Gmail, Outlook, IMAP)
│   ├── Calendar sync (Google, Outlook)
│   ├── RSS feed fetcher (shared cache)
│   ├── Slack WebSocket listener
│   ├── Discord Gateway listener
│   └── Priority queue (active users first)
│
├── imap-proxy (Node.js container) ← NEW, for generic IMAP email
│   └── Persistent IMAP connections (imapflow)
│
├── Web app (static Expo build served by nginx)
│
└── cloudflared (Cloudflare Tunnel daemon)
```

## AI Compute: NOT on the Pi

All AI processing happens off-server:
- **Claude/OpenAI**: User's API key → requests go directly from user's browser/app to Anthropic/OpenAI servers
- **Ollama**: Runs on user's own machine at `http://localhost:11434` — requests go from user's browser/Electron to their local Ollama
- **Pi stores only**: AI connection config (provider, encrypted API key, model preference)
- **Zero AI CPU load on the Pi**

## PgBouncer Configuration

Required because Pi can't handle hundreds of raw PostgreSQL connections.

```ini
# pgbouncer.ini
[databases]
* = host=localhost port=5432

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
pool_mode = transaction        # Best for web apps
max_client_conn = 5000         # Accept up to 5K app connections
default_pool_size = 20         # Only 20 real PG connections
reserve_pool_size = 5
reserve_pool_timeout = 3
server_idle_timeout = 600
```

Docker Compose addition:
```yaml
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    - DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
    - POOL_MODE=transaction
    - MAX_CLIENT_CONN=5000
    - DEFAULT_POOL_SIZE=20
  ports:
    - "6432:6432"
  depends_on:
    - db
  restart: unless-stopped
```

## Cloudflare Tunnel

Free. No port forwarding. SSL handled. Hides home IP.

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  command: tunnel run
  environment:
    - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
  restart: unless-stopped
```

Setup:
1. Create free Cloudflare account
2. Add domain (can use free .dev or own domain)
3. Create tunnel: `cloudflared tunnel create worktracker`
4. Configure tunnel to point to nginx:80
5. DNS automatically configured

Benefits:
- Free SSL certificate (auto-renewed)
- DDoS protection
- Static asset caching (reduces Pi load)
- No exposed home IP address
- Works behind any ISP/NAT

## Sync Worker Design

Replaces Supabase Edge Functions with a persistent Node.js service.

```typescript
// services/sync-worker/index.ts
class SyncWorker {
  private emailQueue: PriorityQueue;
  private calendarQueue: PriorityQueue;
  private rssQueue: Queue;

  async start() {
    // Run sync loops concurrently
    await Promise.all([
      this.emailSyncLoop(),
      this.calendarSyncLoop(),
      this.rssFetchLoop(),
      this.slackWebSocketManager(),
      this.discordGatewayManager(),
    ]);
  }

  // Active users sync every 5 min, inactive every 30 min
  private async emailSyncLoop() {
    while (true) {
      const connections = await getEmailConnections();
      const sorted = prioritize(connections); // Active users first

      for (const conn of sorted) {
        await syncEmail(conn);
        await sleep(100); // Throttle to avoid CPU spikes on Pi
      }

      await sleep(60_000); // Loop every minute, queue handles priority
    }
  }
}
```

Docker:
```yaml
sync-worker:
  build:
    context: ./services/sync-worker
    dockerfile: Dockerfile
  environment:
    - DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/postgres
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
  depends_on:
    - pgbouncer
  restart: unless-stopped
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '1.0'
```

## RSS Shared Feed Cache

Deduplicate identical feed fetches across users:

```sql
-- Shared cache: one row per unique feed URL
CREATE TABLE rss_feed_cache (
  url TEXT PRIMARY KEY,
  content TEXT,                    -- Raw XML/JSON
  etag TEXT,                       -- HTTP ETag for conditional requests
  last_modified TEXT,              -- HTTP Last-Modified header
  last_fetched_at TIMESTAMPTZ,
  next_fetch_at TIMESTAMPTZ,      -- Respect cache headers
  fetch_count INTEGER DEFAULT 0    -- Popularity ranking
);

-- No RLS needed (shared across users, read-only for sync worker)
```

Sync worker fetches each unique URL once, then fans out parsed articles to all subscribed users.

## Resource Allocation (16GB RAM)

| Service | RAM | Notes |
|---------|-----|-------|
| PostgreSQL | 2,048 MB | shared_buffers=2GB, effective_cache_size=8GB |
| PgBouncer | 64 MB | Lightweight |
| GoTrue (Auth) | 128 MB | Light |
| PostgREST | 128 MB | Light |
| Supabase Realtime | 256 MB | Scales with WebSocket connections |
| Supabase Storage | 128 MB | Mostly proxies to disk |
| sync-worker | 512 MB | Node.js with connection pools |
| imap-proxy | 256 MB | Persistent IMAP connections |
| nginx | 64 MB | Static serving |
| cloudflared | 64 MB | Tunnel daemon |
| OS + buffers | 2,048 MB | Linux needs breathing room |
| **Total** | **~5.7 GB** | **10GB free for PostgreSQL file cache** |

PostgreSQL will use the remaining ~10GB as OS page cache, meaning most queries hit memory instead of disk. This is excellent performance.

## Storage Projections (1.8TB)

| Data | Per User/Year | 10K Users | 50K Users |
|------|--------------|-----------|-----------|
| Time entries | 500 KB | 5 GB | 25 GB |
| Email cache (metadata) | 2 MB | 20 GB | 100 GB |
| Calendar cache | 500 KB | 5 GB | 25 GB |
| RSS articles | 5 MB | 50 GB | 250 GB |
| Notes/tasks | 200 KB | 2 GB | 10 GB |
| RSS feed cache (shared) | — | 1 GB | 5 GB |
| Backups (2 copies) | — | 166 GB | 830 GB |
| **Total** | | **~250 GB** | **~1.2 TB** |

You can serve **50K users for years** before storage matters.

## User Capacity Estimates

| Concurrent Users | Experience | CPU Usage | RAM Usage |
|-----------------|-----------|-----------|-----------|
| 1-50 | Excellent (<50ms API) | ~10% | ~6 GB |
| 50-200 | Great (<100ms API) | ~25% | ~7 GB |
| 200-500 | Good (<200ms API) | ~50% | ~8 GB |
| 500-1,000 | Acceptable (<500ms API) | ~75% | ~10 GB |
| 1,000-3,000 | Sync delays 1-2 min | ~90% | ~12 GB |
| 3,000+ | Need second machine | Maxed | Maxed |

## Backup Strategy

```bash
# Daily PostgreSQL backup (cron)
0 3 * * * pg_dump -Fc postgres > /backups/db-$(date +\%Y\%m\%d).dump

# Keep 30 days of daily backups
find /backups -name "db-*.dump" -mtime +30 -delete

# Optional: sync to cloud storage
0 4 * * * rclone sync /backups remote:worktracker-backups
```

## Monitoring

Add lightweight monitoring (no heavy Grafana stack on Pi):

```yaml
# Simple uptime + resource monitoring
healthcheck-cron:
  image: curlimages/curl:latest
  command: >
    sh -c 'while true; do
      curl -sf http://localhost:3000/health || echo "ALERT: app down";
      sleep 60;
    done'
```

Or use [Uptime Kuma](https://github.com/louislam/uptime-kuma) — lightweight, runs on Pi, nice dashboard.

## Network Considerations

| Concern | Solution |
|---------|----------|
| Dynamic home IP | Cloudflare Tunnel (no IP needed) |
| ISP upload bandwidth | Cloudflare caches static assets; API responses are small JSON |
| Power outage | UPS recommended; Docker restart policies handle recovery |
| SD card wear | **Use SSD** (USB or NVMe HAT), never run DB on SD card |
| Pi overheating | Ensure active cooling (fan) under sustained load |
