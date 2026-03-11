# 17 - Token Auto-Refresh System

## Problem

Current Spotify token refresh is **reactive** — only triggers when an API call is made. This works for Spotify (polling every 2s), but other integrations (email, calendar, Slack, Discord) may sit idle and have stale tokens when the user opens their widget.

## Solution: Unified Token Manager

A singleton that monitors all connected services and proactively refreshes tokens before they expire, both client-side and server-side (sync-worker).

## Architecture

```
src/
  lib/
    oauth/
      TokenManager.ts         # Singleton: schedules and executes token refreshes
      TokenRefresher.ts        # Per-provider refresh logic
      OAuthManager.ts          # OAuth flow helpers (existing plan)
      encryption.ts            # Client-side token encryption/decryption
```

## Client-Side Token Manager

```typescript
// src/lib/oauth/TokenManager.ts

interface ManagedConnection {
  id: string;
  provider: string;
  table: string;               // 'spotify_connections' | 'email_connections' | etc.
  expiresAt: Date;
  refreshToken: string;
  timerId: ReturnType<typeof setTimeout> | null;
}

class TokenManager {
  private connections = new Map<string, ManagedConnection>();
  private listeners = new Set<(event: TokenEvent) => void>();

  /**
   * Register a connection for auto-refresh.
   * Called when: user connects a service, app starts, or token is manually refreshed.
   */
  register(connection: {
    id: string;
    provider: string;
    table: string;
    expiresAt: string;
    refreshToken: string;
  }) {
    // Cancel existing timer if re-registering
    this.unregister(connection.id);

    const expiresAt = new Date(connection.expiresAt);
    const managed: ManagedConnection = {
      ...connection,
      expiresAt,
      timerId: null,
    };

    // Schedule refresh 5 minutes before expiry
    const refreshIn = expiresAt.getTime() - Date.now() - 5 * 60 * 1000;

    if (refreshIn <= 0) {
      // Already expired or about to — refresh immediately
      this.refreshNow(managed);
    } else {
      managed.timerId = setTimeout(() => this.refreshNow(managed), refreshIn);
    }

    this.connections.set(connection.id, managed);
  }

  /**
   * Unregister a connection (user disconnects service).
   */
  unregister(connectionId: string) {
    const conn = this.connections.get(connectionId);
    if (conn?.timerId) clearTimeout(conn.timerId);
    this.connections.delete(connectionId);
  }

  /**
   * Get a valid access token for a connection.
   * If expired/expiring, refreshes first.
   */
  async getValidToken(connectionId: string): Promise<string> {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new Error(`Connection ${connectionId} not registered`);

    // If expiring within 60 seconds, refresh now
    if (conn.expiresAt.getTime() - Date.now() < 60_000) {
      return this.refreshNow(conn);
    }

    // Fetch current token from DB
    const { data } = await supabase
      .from(conn.table)
      .select('access_token_encrypted')
      .eq('id', connectionId)
      .single();

    return decrypt(data.access_token_encrypted);
  }

  /**
   * Refresh a token immediately.
   */
  private async refreshNow(conn: ManagedConnection): Promise<string> {
    try {
      const newTokens = await TokenRefresher.refresh(conn.provider, conn.refreshToken);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

      // Update DB
      await supabase
        .from(conn.table)
        .update({
          access_token_encrypted: encrypt(newTokens.access_token),
          refresh_token_encrypted: newTokens.refresh_token
            ? encrypt(newTokens.refresh_token)
            : undefined,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);

      // Update local state
      conn.expiresAt = newExpiresAt;
      if (newTokens.refresh_token) conn.refreshToken = newTokens.refresh_token;

      // Schedule next refresh
      if (conn.timerId) clearTimeout(conn.timerId);
      const nextRefreshIn = newExpiresAt.getTime() - Date.now() - 5 * 60 * 1000;
      conn.timerId = setTimeout(() => this.refreshNow(conn), Math.max(nextRefreshIn, 60_000));

      this.notify({ type: 'refreshed', connectionId: conn.id, provider: conn.provider });
      return newTokens.access_token;
    } catch (err) {
      const msg = String(err);

      if (msg.includes('invalid_grant') || msg.includes('revoked') || msg.includes('401')) {
        // Token permanently invalid — mark as needs reauth
        await supabase
          .from(conn.table)
          .update({ is_active: false })
          .eq('id', conn.id);

        this.notify({ type: 'expired', connectionId: conn.id, provider: conn.provider });
        this.unregister(conn.id);
        throw new Error(`${conn.provider} token revoked. Please reconnect.`);
      }

      // Transient error — retry in 30 seconds
      if (conn.timerId) clearTimeout(conn.timerId);
      conn.timerId = setTimeout(() => this.refreshNow(conn), 30_000);

      this.notify({ type: 'error', connectionId: conn.id, provider: conn.provider, error: msg });
      throw err;
    }
  }

  /**
   * Subscribe to token events (for UI notifications).
   */
  subscribe(listener: (event: TokenEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: TokenEvent) {
    this.listeners.forEach(l => l(event));
  }

  /**
   * Load all active connections on app start.
   */
  async initialize(userId: string) {
    const tables = [
      'spotify_connections',
      'email_connections',
      'calendar_connections',
      'communication_connections',
    ];

    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select('id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
        .eq('is_active', true);

      if (data) {
        for (const row of data) {
          if (row.refresh_token_encrypted && row.token_expires_at) {
            this.register({
              id: row.id,
              provider: table.replace('_connections', ''),
              table,
              expiresAt: row.token_expires_at,
              refreshToken: decrypt(row.refresh_token_encrypted),
            });
          }
        }
      }
    }
  }

  /**
   * Clean up all timers (app shutdown).
   */
  destroy() {
    for (const conn of this.connections.values()) {
      if (conn.timerId) clearTimeout(conn.timerId);
    }
    this.connections.clear();
  }
}

// Singleton
export const tokenManager = new TokenManager();
```

## Token Events (for UI)

```typescript
type TokenEvent =
  | { type: 'refreshed'; connectionId: string; provider: string }
  | { type: 'expired'; connectionId: string; provider: string }
  | { type: 'error'; connectionId: string; provider: string; error: string };
```

When a token expires permanently, the UI shows a banner:

```
⚠ Your Gmail connection expired. [Reconnect]
```

## React Hook

```typescript
// src/hooks/useTokenManager.ts
export function useTokenManager() {
  const { user } = useAuth();

  // Initialize on app start
  useEffect(() => {
    if (user) {
      tokenManager.initialize(user.id);
    }
    return () => tokenManager.destroy();
  }, [user?.id]);

  // Listen for token events
  const [expiredServices, setExpiredServices] = useState<string[]>([]);

  useEffect(() => {
    return tokenManager.subscribe((event) => {
      if (event.type === 'expired') {
        setExpiredServices(prev => [...prev, event.provider]);
      }
      if (event.type === 'refreshed') {
        setExpiredServices(prev => prev.filter(p => p !== event.provider));
      }
    });
  }, []);

  return { expiredServices };
}
```

## Server-Side (Sync Worker)

The sync-worker also refreshes tokens, but differently:

```typescript
// services/sync-worker/tokenRefresh.ts

// Runs every 10 minutes, refreshes tokens expiring within 15 minutes
async function refreshExpiringTokens() {
  const tables = ['email_connections', 'calendar_connections', 'communication_connections'];

  for (const table of tables) {
    const { data: expiring } = await supabase
      .from(table)
      .select('*')
      .eq('is_active', true)
      .lt('token_expires_at', new Date(Date.now() + 15 * 60 * 1000).toISOString());

    for (const conn of expiring ?? []) {
      try {
        const newTokens = await TokenRefresher.refresh(conn.provider, decrypt(conn.refresh_token_encrypted));
        await supabase.from(table).update({
          access_token_encrypted: encrypt(newTokens.access_token),
          refresh_token_encrypted: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : conn.refresh_token_encrypted,
          token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        }).eq('id', conn.id);
      } catch (err) {
        if (isTokenRevoked(err)) {
          await supabase.from(table).update({ is_active: false }).eq('id', conn.id);
        }
        // Else: transient error, will retry next cycle
      }
    }
  }
}

// Run every 10 minutes
setInterval(refreshExpiringTokens, 10 * 60 * 1000);
```

## Migration Path for Existing Spotify

The existing `getValidAccessToken()` in `useSpotify.ts` stays working as-is. The TokenManager wraps it:

1. Phase 1: Build TokenManager, register new integrations only
2. Phase 2: Migrate Spotify to use TokenManager (add `is_active`, `token_expires_at` columns to `spotify_connections` if missing)
3. Phase 3: Remove `getValidAccessToken()` from `useSpotify.ts`, use `tokenManager.getValidToken()` instead

This ensures zero breakage of existing Spotify functionality.

## Token Refresh Timelines by Provider

| Provider | Token Lifetime | Refresh Strategy |
|----------|---------------|-----------------|
| Google (Gmail/Calendar) | 1 hour | Refresh at 55 min |
| Microsoft (Outlook) | 1 hour | Refresh at 55 min |
| Spotify | 1 hour | Refresh at 55 min |
| Slack | No expiry (unless revoked) | Check validity weekly |
| Discord | 7 days | Refresh at day 6 |
