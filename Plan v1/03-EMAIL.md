# 03 - Email Integration

## Phase: 2 (Core Productivity)

## Summary

Full email client with AI-powered summarization, priority sorting, and action item extraction. Supports Gmail (OAuth2), Outlook (Microsoft Graph), and generic IMAP.

## Features

1. **Inbox View** - Read emails with thread grouping
2. **AI Summary** - One-click thread summarization with action items
3. **Compose & Reply** - Send emails with rich text
4. **Labels/Folders** - View and organize by label/folder
5. **Search** - Full-text search across emails
6. **Priority Sorting** - AI ranks emails by urgency/importance
7. **Attachment Preview** - View common attachments inline

## Architecture

```
src/
  lib/
    email/
      EmailEngine.ts          # Abstraction over providers
      providers/
        GmailProvider.ts      # Gmail API via OAuth2
        OutlookProvider.ts    # Microsoft Graph API
        IMAPProvider.ts       # Generic IMAP (via proxy)
      types.ts                # Email, Thread, Label types
  hooks/
    useEmail.ts               # Email queries (inbox, thread, search)
    useEmailMutations.ts      # Send, reply, archive, label
    useEmailSummary.ts        # AI summarization hook
  components/
    email/
      EmailWidget.tsx         # Hub widget (unread count + previews)
      EmailInbox.tsx          # Full inbox view
      EmailThread.tsx         # Thread conversation view
      EmailCompose.tsx        # Compose/reply modal
      EmailSearch.tsx         # Search interface
      EmailAISummary.tsx      # AI summary card
    settings/
      EmailSettings.tsx       # Connect/disconnect email accounts
  screens/
    EmailScreen.tsx           # Full email screen (expandable from widget)
```

## Provider Implementations

### Gmail (Google OAuth2)

**OAuth Flow:**
- Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`, `gmail.labels`
- Redirect: Same pattern as existing Google Auth, but with additional scopes
- Token stored in `email_connections` table

**API Endpoints:**
- `GET /gmail/v1/users/me/messages` - List messages
- `GET /gmail/v1/users/me/messages/{id}` - Get message
- `POST /gmail/v1/users/me/messages/send` - Send message
- `GET /gmail/v1/users/me/labels` - List labels
- `POST /gmail/v1/users/me/messages/{id}/modify` - Add/remove labels

### Outlook (Microsoft Graph)

**OAuth Flow:**
- Scopes: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`
- Authority: `https://login.microsoftonline.com/common/oauth2/v2.0`
- Token stored in `email_connections` table

**API Endpoints:**
- `GET /me/messages` - List messages
- `GET /me/messages/{id}` - Get message
- `POST /me/sendMail` - Send message
- `GET /me/mailFolders` - List folders

### IMAP Generic

**Connection:**
- User provides: host, port, username, password, SMTP host/port
- Connection via a lightweight proxy service (needed because browsers can't do raw IMAP)
- **Option A**: Supabase Edge Function as IMAP proxy
- **Option B**: Self-hosted Node.js proxy with `imapflow` library
- Credentials encrypted and stored in `email_connections`

**Note:** IMAP requires a server-side proxy since browsers cannot open TCP sockets. This is the most complex provider.

## Database Schema

```sql
CREATE TABLE email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL,          -- 'gmail' | 'outlook' | 'imap'
  email_address TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  imap_config JSONB,               -- For IMAP: host, port, smtp_host, smtp_port
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, email_address)
);

-- Local email cache (for offline + performance)
CREATE TABLE email_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  connection_id UUID REFERENCES email_connections NOT NULL,
  message_id TEXT NOT NULL,         -- Provider's message ID
  thread_id TEXT,
  subject TEXT,
  sender TEXT,
  sender_email TEXT,
  snippet TEXT,                     -- Preview text
  received_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  labels TEXT[],
  ai_summary TEXT,                  -- Cached AI summary
  ai_priority INTEGER,             -- AI-assigned priority (1-5)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, message_id)
);

-- RLS on both tables
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_connections" ON email_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_cache" ON email_cache FOR ALL USING (auth.uid() = user_id);
```

## AI Features

### Email Summarization
- Summarize individual emails or entire threads
- Extract action items as bullet points
- Identify urgency level (urgent / needs response / FYI)
- Cache summaries in `email_cache.ai_summary`

### Priority Sorting
- AI analyzes sender, subject, content, and patterns
- Assigns priority 1-5 (stored in `email_cache.ai_priority`)
- Re-ranks on each sync
- User can override priority

### Smart Compose (Future)
- AI drafts replies based on context
- Tone selection (professional, casual, brief)

## Sync Strategy

- **Initial sync**: Fetch last 50 emails per account
- **Incremental sync**: Poll every 5 minutes for new emails (or use push notifications where available)
- **Gmail**: Use `historyId` for efficient incremental sync
- **Outlook**: Use `deltaLink` for delta queries
- **Background sync**: Supabase Edge Function runs periodic sync
- **Cache**: Store email metadata + snippets in Supabase, full body fetched on demand

## Email Widget (Hub)

```
+---------------------------------------+
|  Email                          3 new |
|  ─────────────────────────────────── |
|  ★ Invoice from Acme Corp       2m   |
|    Action needed: approve $1,200      |
|  ─────────────────────────────────── |
|  Sarah Chen - Meeting notes     15m   |
|    Summary of Q4 planning...          |
|  ─────────────────────────────────── |
|  [View All]         [Compose]         |
+---------------------------------------+
```
