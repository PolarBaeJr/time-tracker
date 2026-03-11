# 12 - Complete Database Schema (All New Tables)

## Summary

All new tables follow existing patterns:
- UUID primary keys with `gen_random_uuid()`
- `user_id` with `DEFAULT auth.uid()` (never set from client)
- RLS enabled on every table
- `created_at` / `updated_at` timestamps
- Soft deletes where appropriate (`deleted_at`)

---

## Migration Order

Migrations must be created in this order (respects foreign key dependencies):

1. `ai_connections` (Phase 1 - no dependencies)
2. `notes` (Phase 3 - depends on categories)
3. `tasks` (Phase 3 - depends on categories, time_entries)
4. `email_connections` (Phase 2 - no dependencies)
5. `email_cache` (Phase 2 - depends on email_connections)
6. `calendar_connections` (Phase 2 - no dependencies)
7. `calendar_events_cache` (Phase 2 - depends on calendar_connections, time_entries)
8. `communication_connections` (Phase 4 - no dependencies)
9. `rss_feeds` (Phase 4 - no dependencies)
10. `rss_articles` (Phase 4 - depends on rss_feeds)
11. `ai_digests` (Phase 4 - no dependencies)
12. `quick_links` (Phase 5 - no dependencies)

---

## Complete SQL

```sql
-- ============================================================
-- Phase 1: AI Engine
-- ============================================================

CREATE TABLE ai_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'openai', 'ollama')),
  api_key_encrypted TEXT,
  model TEXT,
  base_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE ai_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own AI connections"
  ON ai_connections FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_connections_updated_at
  BEFORE UPDATE ON ai_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Phase 2: Email
-- ============================================================

CREATE TABLE email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
  email_address TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  imap_config_encrypted TEXT,       -- Encrypted JSON for IMAP settings
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_cursor TEXT,                  -- Provider-specific sync cursor
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, email_address)
);

ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own email connections"
  ON email_connections FOR ALL USING (auth.uid() = user_id);

CREATE TABLE email_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  connection_id UUID REFERENCES email_connections ON DELETE CASCADE NOT NULL,
  message_id TEXT NOT NULL,
  thread_id TEXT,
  subject TEXT,
  sender_name TEXT,
  sender_email TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  labels TEXT[],
  ai_summary TEXT,
  ai_priority INTEGER CHECK (ai_priority BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, message_id)
);

ALTER TABLE email_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own email cache"
  ON email_cache FOR ALL USING (auth.uid() = user_id);

-- Auto-cleanup old email cache (Edge Function or cron)
CREATE INDEX idx_email_cache_received ON email_cache(received_at);
CREATE INDEX idx_email_cache_connection ON email_cache(connection_id);

-- ============================================================
-- Phase 2: Calendar
-- ============================================================

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
  account_email TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  selected_calendars TEXT[],
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  auto_log_enabled BOOLEAN DEFAULT false,
  focus_block_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, account_email)
);

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendar connections"
  ON calendar_connections FOR ALL USING (auth.uid() = user_id);

CREATE TABLE calendar_events_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  connection_id UUID REFERENCES calendar_connections ON DELETE CASCADE NOT NULL,
  event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  attendees JSONB DEFAULT '[]',
  organizer TEXT,
  status TEXT DEFAULT 'confirmed',
  recurrence_rule TEXT,
  time_entry_id UUID REFERENCES time_entries ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, event_id)
);

ALTER TABLE calendar_events_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendar events"
  ON calendar_events_cache FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_calendar_events_date ON calendar_events_cache(start_at, end_at);
CREATE INDEX idx_calendar_events_connection ON calendar_events_cache(connection_id);

-- ============================================================
-- Phase 3: Notes & Tasks
-- ============================================================

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title TEXT,
  content TEXT,
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  category_id UUID REFERENCES categories ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes"
  ON notes FOR ALL USING (auth.uid() = user_id);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  category_id UUID REFERENCES categories ON DELETE SET NULL,
  time_entry_id UUID REFERENCES time_entries ON DELETE SET NULL,
  recurrence_rule TEXT,
  parent_task_id UUID REFERENCES tasks ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks"
  ON tasks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_due ON tasks(due_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;

-- ============================================================
-- Phase 4: Communications
-- ============================================================

CREATE TABLE communication_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'discord')),
  account_name TEXT,
  workspace_name TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  bot_token_encrypted TEXT,
  workspace_id TEXT,
  token_expires_at TIMESTAMPTZ,
  status_sync_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE communication_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own communication connections"
  ON communication_connections FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Phase 4: News/RSS
-- ============================================================

CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  favicon_url TEXT,
  last_fetched_at TIMESTAMPTZ,
  fetch_error TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, url)
);

ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own feeds"
  ON rss_feeds FOR ALL USING (auth.uid() = user_id);

CREATE TABLE rss_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  feed_id UUID REFERENCES rss_feeds ON DELETE CASCADE NOT NULL,
  guid TEXT NOT NULL,
  title TEXT,
  link TEXT,
  content TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_saved BOOLEAN DEFAULT false,
  ai_summary TEXT,
  ai_topics TEXT[],
  ai_relevance REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_id, guid)
);

ALTER TABLE rss_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own articles"
  ON rss_articles FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_rss_articles_feed ON rss_articles(feed_id);
CREATE INDEX idx_rss_articles_published ON rss_articles(published_at);

CREATE TABLE ai_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  digest_date DATE NOT NULL,
  content TEXT NOT NULL,
  article_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, digest_date)
);

ALTER TABLE ai_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own digests"
  ON ai_digests FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Phase 5: Quick Links
-- ============================================================

CREATE TABLE quick_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quick_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own links"
  ON quick_links FOR ALL USING (auth.uid() = user_id);
```

## Supabase Edge Functions (New)

| Function | Purpose | Phase |
|----------|---------|-------|
| `fetch-rss` | Proxy RSS feed fetching (CORS bypass + SSRF protection) | 4 |
| `sync-emails` | Background email sync (cron) | 2 |
| `sync-calendar` | Background calendar sync (cron) | 2 |
| `imap-proxy` | IMAP/SMTP proxy for generic email | 2 |
| `cleanup-cache` | Purge old email/calendar cache | 2 |
