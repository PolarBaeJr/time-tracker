# 09 - Utilities (Weather, Quick Links, Clipboard Manager)

## Phase: 5 (Utilities)

## Weather Widget

### Features
- Current temperature, condition, icon
- High/low for today
- Expandable 3-day forecast
- Auto-detect location or manual city entry

### Implementation
- **API**: OpenWeatherMap (free tier: 1000 calls/day) or WeatherAPI.com
- **No OAuth needed** - just an API key (stored in ai_connections or a general `api_keys` table)
- **Location**: Use browser Geolocation API or let user type city name
- **Cache**: Cache weather data for 30 minutes (TanStack Query staleTime)
- **Cross-platform**: Works everywhere (just HTTP API calls)

### Database
```sql
-- Weather preferences stored in user preferences JSONB
-- { "weather": { "location": "San Francisco", "units": "imperial", "api_key": "..." } }
```

### Widget
```
+------------------+
|  Weather    SF   |
|  ☀️ 72°F        |
|  H: 78° L: 62°  |
+------------------+
```

---

## Quick Links / Bookmarks

### Features
- Grid of frequently used links with icons/favicons
- Categories (Work, Personal, Tools)
- Click to open in browser
- Drag to reorder

### Implementation
- Stored in Supabase `quick_links` table
- Favicon fetched via `https://www.google.com/s2/favicons?domain=`
- Open via `Linking.openURL()` (React Native) or `window.open()` (web)

### Database
```sql
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
CREATE POLICY "own" ON quick_links FOR ALL USING (auth.uid() = user_id);
```

### Widget
```
+---------------------------------------+
|  Quick Links                          |
|  ─────────────────────────────────── |
|  [GitHub]  [Figma]  [Notion]  [+]    |
|  [Jira]    [Slack]  [Gmail]          |
+---------------------------------------+
```

---

## Clipboard Manager

### Features
- History of copied items (text, URLs, code snippets)
- Search clipboard history
- Click to re-copy
- Pin frequently used items
- **Desktop only** (Electron) - needs system clipboard access

### Implementation
- **Electron**: Use `clipboard` module with polling (check every 500ms for changes)
- **Storage**: Local only (never sync clipboard to server for security)
- **Limit**: Keep last 100 items
- **Web/Mobile**: Show a simplified "pinned snippets" version (manual save)

### Architecture
```
electron/
  clipboardWatcher.ts          # Poll system clipboard for changes

src/
  components/
    clipboard/
      ClipboardWidget.tsx      # Hub widget
      ClipboardHistory.tsx     # Full history view
      ClipboardItem.tsx        # Single item
  hooks/
    useClipboard.ts            # Access clipboard history
  stores/
    clipboardStore.ts          # Zustand store for clipboard items
```

### Preload API Addition
```typescript
// electron/preload.ts additions
clipboardHistory: () => ipcRenderer.invoke('clipboard:history'),
clipboardCopy: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
onClipboardChange: (cb: (text: string) => void) => {
  ipcRenderer.on('clipboard:change', (_, text) => cb(text));
}
```

### Widget
```
+---------------------------------------+
|  Clipboard                    12 items|
|  ─────────────────────────────────── |
|  📋 https://github.com/pr/42    [📌] |
|  📋 const foo = bar.map(...)    [📌] |
|  📋 Meeting notes from...       [📌] |
|  ─────────────────────────────────── |
|  [Search]              [Clear All]    |
+---------------------------------------+
```

### Security Note
- Clipboard data is **never** synced to Supabase
- Stored in encrypted localStorage/AsyncStorage only
- Auto-clear items older than 24 hours
- Skip items that look like passwords (detected patterns)
