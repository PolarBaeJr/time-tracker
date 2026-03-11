# 13 - Authentication & Connection Flows

## Overview

Each integration uses per-service OAuth2 (matching the existing Spotify pattern). Users connect/disconnect services in Settings. All tokens stored encrypted in Supabase with RLS.

---

## Connection Architecture

### Settings Screen Addition

```
Settings
├── Account (existing)
├── Preferences (existing)
├── Spotify (existing)
├── ─── New Connections ───
├── AI Assistant        [Claude ✓] [Configure]
├── Email              [Gmail ✓] [Outlook] [+ Add]
├── Calendar           [Google ✓] [+ Add]
├── Slack              [Connect]
├── Discord            [Connect]
├── News/RSS           [Manage Feeds]
├── Weather            [Configure]
└── Quick Links        [Manage]
```

### Shared OAuth Utilities

```typescript
// src/lib/oauth/OAuthManager.ts
interface OAuthConfig {
  provider: string;
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
  usePKCE: boolean;
}

class OAuthManager {
  // Shared across all OAuth integrations
  async startAuthFlow(config: OAuthConfig): Promise<void>;
  async handleCallback(code: string, state: string): Promise<TokenPair>;
  async refreshToken(provider: string, refreshToken: string): Promise<TokenPair>;
  async revokeToken(provider: string, token: string): Promise<void>;
}
```

---

## Per-Service OAuth Details

### 1. Gmail (Google OAuth2)

| Field | Value |
|-------|-------|
| Auth URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token URL | `https://oauth2.googleapis.com/token` |
| Scopes | `gmail.readonly gmail.send gmail.modify gmail.labels` |
| PKCE | Yes |
| Client ID | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (existing, request additional scopes) |
| Redirect | Web: `/auth/callback`, Electron: `http://127.0.0.1:54321/google/callback` |

**Note**: If user already signed in with Google, we can request incremental scopes without re-authentication (Google supports incremental authorization).

### 2. Outlook (Microsoft OAuth2)

| Field | Value |
|-------|-------|
| Auth URL | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Scopes | `Mail.Read Mail.Send Mail.ReadWrite offline_access` |
| PKCE | Yes |
| Client ID | `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` (new env var) |
| Redirect | Web: `/auth/callback`, Electron: `http://127.0.0.1:54321/microsoft/callback` |

**Setup**: Register app at Azure Portal > App registrations. Support personal + work accounts.

### 3. Google Calendar

| Field | Value |
|-------|-------|
| Auth URL | Same as Gmail (Google OAuth2) |
| Token URL | Same as Gmail |
| Scopes | `calendar.readonly calendar.events calendar.settings.readonly` |
| PKCE | Yes |
| Client ID | Same as Gmail (shared Google OAuth) |

**Note**: If Gmail already connected, just request additional calendar scopes. Token upgrade, not new connection.

### 4. Outlook Calendar

| Field | Value |
|-------|-------|
| Auth URL | Same as Outlook email |
| Token URL | Same as Outlook email |
| Scopes | `Calendars.Read Calendars.ReadWrite offline_access` |
| PKCE | Yes |
| Client ID | Same as Outlook email (shared Microsoft OAuth) |

**Note**: Same as Gmail pattern - if Outlook email connected, request additional scopes.

### 5. Slack

| Field | Value |
|-------|-------|
| Auth URL | `https://slack.com/oauth/v2/authorize` |
| Token URL | `https://slack.com/api/oauth.v2.access` |
| Scopes | `channels:read,chat:write,users:read,users.profile:write,im:read,im:write` |
| PKCE | No (Slack doesn't support PKCE, use state parameter) |
| Client ID | `EXPO_PUBLIC_SLACK_CLIENT_ID` (new env var) |
| Client Secret | Server-side only (Supabase Edge Function for token exchange) |
| Redirect | Web: `/auth/callback`, Electron: `http://127.0.0.1:54321/slack/callback` |

**Important**: Slack requires a client secret for token exchange. This MUST happen server-side (Supabase Edge Function), never in the client.

### 6. Discord

| Field | Value |
|-------|-------|
| Auth URL | `https://discord.com/api/oauth2/authorize` |
| Token URL | `https://discord.com/api/oauth2/token` |
| Scopes | `identify guilds messages.read` |
| PKCE | No (use state parameter) |
| Client ID | `EXPO_PUBLIC_DISCORD_CLIENT_ID` (new env var) |
| Client Secret | Server-side only |
| Redirect | Web: `/auth/callback`, Electron: `http://127.0.0.1:54321/discord/callback` |

**Important**: Like Slack, Discord requires server-side token exchange.

### 7. AI Providers (API Key, not OAuth)

No OAuth needed. User enters API key directly:

```
Settings > AI Assistant > [Provider] > Enter API Key
```

- Key validated with a test request (e.g., list models)
- Key encrypted client-side, stored in `ai_connections`
- Ollama: user enters base URL (default `http://localhost:11434`)

### 8. Weather (API Key, not OAuth)

```
Settings > Weather > Enter API Key (OpenWeatherMap)
```

Or offer built-in free tier via a shared app key (with rate limiting).

### 9. IMAP Email (Credentials, not OAuth)

```
Settings > Email > Add IMAP Account
  Server: imap.example.com
  Port: 993
  Username: user@example.com
  Password: ••••••••
  SMTP Server: smtp.example.com
  SMTP Port: 587
```

- Credentials encrypted and stored in `email_connections.imap_config_encrypted`
- Connection tested before saving
- All IMAP traffic proxied through Supabase Edge Function

---

## Callback Router

Extend the existing callback handling in `src/navigation/index.tsx` and `electron/main.ts`:

### Web (navigation/index.tsx)
```typescript
// Add callback routes for each provider
const callbackRoutes: Record<string, (params: URLSearchParams) => void> = {
  '/auth/callback': handleGoogleCallback,     // existing
  '/spotify/callback': handleSpotifyCallback,  // existing
  '/microsoft/callback': handleMicrosoftCallback,
  '/slack/callback': handleSlackCallback,
  '/discord/callback': handleDiscordCallback,
};
```

### Electron (main.ts)
```typescript
// Extend the localhost server to handle multiple callback paths
server.on('request', (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);

  switch (url.pathname) {
    case '/auth/callback':     // existing Google
    case '/spotify/callback':  // existing Spotify
    case '/microsoft/callback':
    case '/slack/callback':
    case '/discord/callback':
      handleOAuthCallback(url.pathname, url.searchParams);
      break;
  }
});
```

---

## Token Refresh Strategy

All OAuth tokens have expiry. Implement a unified refresh mechanism:

```typescript
// src/lib/oauth/TokenRefresher.ts
class TokenRefresher {
  // Check token expiry before each API call
  async getValidToken(provider: string, connectionId: string): Promise<string> {
    const connection = await getConnection(connectionId);
    if (isExpired(connection.token_expires_at)) {
      const newTokens = await refreshToken(provider, connection.refresh_token);
      await updateConnection(connectionId, newTokens);
      return newTokens.access_token;
    }
    return decrypt(connection.access_token_encrypted);
  }
}
```

- Refresh tokens 5 minutes before expiry (proactive refresh)
- If refresh fails: mark connection as "needs reauth", show banner to user
- Never silently fail token refresh

---

## Environment Variables (New)

Add to `.env.example`:
```
# Microsoft OAuth (Outlook + Calendar)
EXPO_PUBLIC_MICROSOFT_CLIENT_ID=

# Slack OAuth
EXPO_PUBLIC_SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=              # Server-side only (Edge Function)

# Discord OAuth
EXPO_PUBLIC_DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=            # Server-side only (Edge Function)

# Weather
EXPO_PUBLIC_WEATHER_API_KEY=      # OpenWeatherMap API key

# AI (optional - users enter their own keys)
# No env vars needed - keys stored per-user in Supabase
```
