# 08 - News/RSS Feed with AI Digest

## Phase: 4 (Communication)

## Summary

RSS feed reader with AI-powered daily digest and topic filtering. Subscribe to feeds, get a morning briefing, and let AI categorize articles by relevance.

## Features

1. **RSS Feed Subscription** - Add feeds by URL
2. **AI Daily Digest** - Morning briefing summarizing top stories across all feeds
3. **Topic Filtering** - AI categorizes articles, user sets interest preferences
4. **Article View** - Read articles inline with readability mode
5. **AI Article Summary** - One-click summary of any article
6. **Save for Later** - Bookmark articles to read later

## Architecture

```
src/
  lib/
    news/
      RSSParser.ts             # Parse RSS/Atom feeds
      NewsTypes.ts
  hooks/
    useFeeds.ts                # Feed subscriptions
    useFeedArticles.ts         # Articles from feeds
    useAIDigest.ts             # AI-generated daily digest
  components/
    news/
      NewsWidget.tsx           # Hub widget (daily digest preview)
      FeedList.tsx             # All feeds with article counts
      ArticleList.tsx          # Articles from a feed
      ArticleView.tsx          # Full article reader
      ArticleSummary.tsx       # AI summary card
      DailyDigest.tsx          # AI morning briefing
      AddFeedModal.tsx         # Subscribe to new feed
    settings/
      NewsSettings.tsx         # Manage feeds, interests
  screens/
    NewsScreen.tsx
```

## Database Schema

```sql
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  favicon_url TEXT,
  last_fetched_at TIMESTAMPTZ,
  fetch_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, url)
);

CREATE TABLE rss_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  feed_id UUID REFERENCES rss_feeds NOT NULL,
  guid TEXT NOT NULL,              -- Article unique ID from feed
  title TEXT,
  link TEXT,
  content TEXT,                    -- Full or partial content
  author TEXT,
  published_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_saved BOOLEAN DEFAULT false,  -- Bookmarked
  ai_summary TEXT,
  ai_topics TEXT[],                -- AI-assigned topics
  ai_relevance REAL,               -- 0.0 to 1.0 relevance score
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_id, guid)
);

CREATE TABLE ai_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  digest_date DATE NOT NULL,
  content TEXT NOT NULL,           -- Markdown digest
  article_ids UUID[],             -- Articles included
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, digest_date)
);

-- RLS
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON rss_feeds FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON rss_articles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON ai_digests FOR ALL USING (auth.uid() = user_id);
```

## RSS Parsing

Since browsers can't fetch arbitrary URLs (CORS), RSS parsing needs a proxy:

**Option A**: Supabase Edge Function as RSS proxy
```
POST /functions/v1/fetch-rss
Body: { url: "https://example.com/feed.xml" }
Returns: parsed articles
```

**Option B**: Use a public RSS-to-JSON API (e.g., rss2json.com)

**Option C**: Electron-only fetching (no CORS in Node.js), web falls back to proxy

Recommended: **Option A** (Supabase Edge Function) for cross-platform consistency.

## AI Daily Digest

Generated on first app open each day (or on demand):

1. Fetch unread articles from last 24h
2. AI ranks by relevance to user's interests
3. AI generates a 3-5 paragraph briefing covering top stories
4. Cached in `ai_digests` table (one per day)

### Digest Format
```markdown
## Your Morning Briefing - March 10

### Tech
Apple announced new MacBook Pro with M5 chip, featuring...
[React 20 released](link) with significant performance improvements...

### Business
Markets rallied 2% on positive jobs data...

### Your Interests
New TypeScript 6.0 features include pattern matching...
```

## News Widget (Hub)

```
+---------------------------------------+
|  News Digest                  Mar 10  |
|  ─────────────────────────────────── |
|  📰 Apple unveils M5 MacBook Pro     |
|  📰 React 20 brings pattern matching |
|  📰 Markets rally on jobs data       |
|  ─────────────────────────────────── |
|  [Read Full Digest]   [All Articles] |
+---------------------------------------+
```

## Feed Sync

- Fetch feeds every 30 minutes (background)
- Supabase Edge Function cron job or client-side polling
- Keep last 100 articles per feed
- Auto-cleanup articles older than 30 days
