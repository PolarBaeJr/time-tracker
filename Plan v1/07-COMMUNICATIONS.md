# 07 - Communications (Slack, Discord, WhatsApp)

## Phase: 4 (Communication)

## Summary

Notification + quick reply integrations for Slack, Discord, and WhatsApp. Shows unread messages/mentions, allows quick replies inline, and syncs status with timer state.

## Slack Integration

### Features
- View unread messages and mentions
- Quick reply to messages
- Auto-set Slack status based on timer (focusing / on break / available)
- Show channel list with unread counts

### OAuth Flow
- App: Create Slack App at api.slack.com
- Scopes: `channels:read`, `chat:write`, `users:read`, `users.profile:write`, `im:read`, `im:write`, `mpim:read`
- OAuth2 with redirect to `http://127.0.0.1:54321/slack/callback` (Electron) or web callback
- Token stored in `communication_connections` table

### API
- `conversations.list` - Get channels
- `conversations.history` - Get messages
- `chat.postMessage` - Send message
- `users.profile.set` - Update status
- WebSocket: Slack Socket Mode for real-time messages (requires app-level token)

### Status Sync
When timer starts:
```json
{ "status_text": "Focusing on Development", "status_emoji": ":dart:", "status_expiration": <timer_end> }
```
When timer stops or break starts:
```json
{ "status_text": "On a break", "status_emoji": ":coffee:", "status_expiration": <break_end> }
```
When session ends: Clear status

## Discord Integration

### Features
- View unread DMs and mentions
- Quick reply to DMs
- Rich presence showing current timer activity
- Server/channel unread counts

### OAuth Flow
- App: Create Discord App at discord.com/developers
- Scopes: `identify`, `messages.read`, `guilds`
- OAuth2 with redirect pattern matching other services
- Token stored in `communication_connections` table
- **Note**: Discord Bot token needed for some features (user creates bot, adds to server)

### API
- `GET /users/@me/guilds` - List servers
- `GET /channels/{id}/messages` - Get messages
- `POST /channels/{id}/messages` - Send message
- Gateway WebSocket for real-time events

### Rich Presence
- Show "Working on [Category]" in Discord presence
- Requires Discord RPC (Electron only via IPC)

## WhatsApp Web View

### Features
- Embedded WhatsApp Web in a webview
- Quick access without switching apps
- **Note**: This is a webview wrapper, not a native API integration (WhatsApp doesn't offer a personal messaging API)

### Implementation
- Use `react-native-webview` or Electron `BrowserView`
- URL: `https://web.whatsapp.com`
- User authenticates via QR code within the webview
- **Desktop only** (Electron) - webview works best on desktop
- Mobile: Deep link to WhatsApp app instead

## Architecture

```
src/
  lib/
    communications/
      SlackProvider.ts
      DiscordProvider.ts
      types.ts
  hooks/
    useSlack.ts
    useSlackMutations.ts
    useDiscord.ts
    useDiscordMutations.ts
  components/
    communications/
      SlackWidget.tsx          # Hub widget
      DiscordWidget.tsx        # Hub widget
      WhatsAppWidget.tsx       # Hub widget (webview)
      SlackMessageList.tsx
      DiscordMessageList.tsx
      QuickReplyInput.tsx
      StatusSyncSettings.tsx
    settings/
      SlackSettings.tsx
      DiscordSettings.tsx
      WhatsAppSettings.tsx
  screens/
    SlackScreen.tsx
    DiscordScreen.tsx
    WhatsAppScreen.tsx
```

## Database Schema

```sql
CREATE TABLE communication_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL,          -- 'slack' | 'discord'
  account_name TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  bot_token_encrypted TEXT,        -- Discord bot token
  workspace_id TEXT,               -- Slack workspace ID
  token_expires_at TIMESTAMPTZ,
  status_sync_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS
ALTER TABLE communication_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_connections" ON communication_connections
  FOR ALL USING (auth.uid() = user_id);
```

## Widget UIs

### Slack Widget
```
+---------------------------------------+
|  Slack                        5 new   |
|  ─────────────────────────────────── |
|  #general         @you: Can you...  2m|
|  #engineering     PR merged! 🎉   15m |
|  @Sarah (DM)      Hey, quick q... 30m |
|  ─────────────────────────────────── |
|  Status: 🎯 Focusing on Development  |
|  [Open Slack]                         |
+---------------------------------------+
```

### Discord Widget
```
+---------------------------------------+
|  Discord                      3 new   |
|  ─────────────────────────────────── |
|  #project-chat    New deploy...   5m  |
|  @Matt (DM)       Check this out 20m  |
|  ─────────────────────────────────── |
|  [Open Discord]                       |
+---------------------------------------+
```
