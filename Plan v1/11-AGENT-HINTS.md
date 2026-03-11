# 11 - Agent Hints (Security & Pattern Guide for Coding Agents)

## Purpose

These hints guide coding agents (Claude, Codex, etc.) to avoid common pitfalls when implementing new features. Each hint addresses a specific security or architectural concern.

---

## HINT 1: Never Break Existing Code

```
CRITICAL: This is an existing production app. Before modifying ANY existing file:
1. Read the entire file first
2. Understand all imports and exports
3. Test that existing functionality still works after your changes
4. Never remove existing exports (other files may depend on them)
5. Never change function signatures of existing public APIs
6. Add new code alongside existing code, don't replace it
```

## HINT 2: RLS on Every New Table

```
EVERY new table MUST have Row Level Security enabled.
Pattern to follow (copy from existing tables):

ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own <table>" ON <table_name>
  FOR ALL USING (auth.uid() = user_id);

NEVER set user_id from the client. Always use:
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid()
```

## HINT 3: Token Encryption

```
All OAuth tokens and API keys stored in Supabase MUST be encrypted.
NEVER store raw tokens in the database.

Pattern:
1. Generate encryption key from user's session
2. Encrypt token client-side: AES-256-GCM
3. Store ciphertext in *_encrypted column
4. Decrypt only in memory when needed
5. NEVER log tokens, even in debug mode
6. NEVER include tokens in error messages
```

## HINT 4: Date Handling

```
EXISTING BUG PATTERN - NEVER use: new Date(dateString) for YYYY-MM-DD strings
This causes UTC timezone offset bugs.

ALWAYS use: new Date(year, month - 1, day) for local dates
See: src/screens/GoalsScreen.tsx for correct pattern
See: src/utils/ for parseLocalDate utility
```

## HINT 5: OAuth Flow Pattern

```
Follow the EXISTING Spotify OAuth pattern for all new OAuth integrations:

1. Generate PKCE code_verifier + code_challenge
2. Store state + verifier in sessionStorage (not localStorage)
3. Redirect to provider's auth URL
4. Handle callback at /[service]/callback
5. Exchange code for tokens
6. Encrypt and store tokens in Supabase
7. Clean up sessionStorage

Reference files:
- src/lib/spotify.ts (OAuth helpers)
- src/navigation/index.tsx (callback handling)
- electron/main.ts (callback server)
```

## HINT 6: HTML Content Sanitization

```
When rendering external HTML content (emails, RSS, web content):

NEVER render raw HTML in the React tree.
ALWAYS sanitize with DOMPurify or equivalent:

import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(htmlContent, {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'alt'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'style']
});

For React Native: use react-native-render-html with custom renderers.
```

## HINT 7: AI Prompt Safety

```
When building AI prompts that include user data:

1. Use clear delimiters between system instructions and user data:
   System: <instructions>
   ---USER DATA START---
   {email_content}
   ---USER DATA END---

2. Never let user data appear before system instructions
3. Validate AI tool call outputs before executing them
4. Rate limit: max 5 AI-triggered actions per conversation
5. Always require user confirmation for destructive actions
6. Cache AI responses to avoid redundant API calls
```

## HINT 8: Electron Preload Bridge

```
When adding new Electron IPC channels:

1. Define the channel in electron/preload.ts contextBridge
2. Handle in electron/main.ts via ipcMain.handle()
3. NEVER expose Node.js APIs directly
4. NEVER use ipcRenderer.send() without validation
5. Always validate and sanitize IPC arguments

Pattern:
// preload.ts
newFeature: (arg: string) => ipcRenderer.invoke('feature:action', arg)

// main.ts
ipcMain.handle('feature:action', async (event, arg) => {
  // Validate arg
  // Execute action
  // Return result
});

Update src/types/desktop.d.ts with the new API types.
```

## HINT 9: State Management Pattern

```
Follow existing patterns for state management:

SERVER STATE (data from Supabase/APIs): Use TanStack Query
- Define queryKey in src/lib/queryClient.ts
- Create custom hook in src/hooks/
- Use mutations for write operations
- Set appropriate staleTime and gcTime

CLIENT STATE (UI state, preferences): Use Zustand
- Create store in src/stores/
- Use useSyncExternalStore for cross-component state

NEVER mix these patterns. Don't use useState for data that should be in TanStack Query.
```

## HINT 10: Widget Development Pattern

```
When creating a new Hub widget:

1. Create widget component in src/components/hub/widgets/
2. Register in src/components/hub/WidgetRegistry.ts
3. Widget MUST implement WidgetProps interface
4. Widget MUST have its own error boundary
5. Widget MUST show skeleton loading state
6. Widget MUST handle "no data" / "not connected" states gracefully
7. Widget data fetching MUST be independent (own TanStack Query hook)
8. Widget MUST respect size prop (small/medium/large)
9. Widget MUST work on all platforms (web, mobile, desktop)
```

## HINT 11: RSS/External URL Fetching

```
When fetching external URLs (RSS feeds, article content):

1. NEVER fetch from the client directly (CORS will block it)
2. Use Supabase Edge Function as proxy
3. In the Edge Function:
   - Validate URL format
   - Block private/internal IPs (10.x, 172.16.x, 192.168.x, 127.x)
   - Set timeout (10 seconds max)
   - Limit response size (1MB max)
   - Return sanitized content only
4. Rate limit: max 100 feed fetches per user per hour
```

## HINT 12: Environment Variables

```
All new secrets/keys MUST use environment variables:
- Client-side: EXPO_PUBLIC_* prefix (bundled into app)
- Server-side: Regular env vars (Supabase Edge Functions)

NEVER hardcode:
- API keys
- Client IDs
- Client secrets
- Encryption keys
- Service URLs that may change

Add all new env vars to .env.example with placeholder values.
```

## HINT 13: Cross-Platform Compatibility

```
All features must work on: Web, Electron, iOS, Android

Platform-specific code pattern:
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  // Web + Electron code
} else {
  // Native (iOS/Android) code
}

For Electron-specific:
if (typeof window !== 'undefined' && window.desktop?.platform?.isElectron) {
  // Electron-only code
}

Desktop-only features (clipboard manager): Show "Desktop only" message on mobile.
```

## HINT 14: Uber-Style UI Layout

```
The UI should follow Uber's design language:
- Clean, minimal, lots of whitespace
- Dark mode first with light mode support
- Large touch targets (minimum 44px)
- Card-based layout with subtle shadows
- Bottom sheet modals (not centered dialogs)
- Smooth animations (react-native-reanimated)
- Typography hierarchy: bold headers, light body text
- Color: user-customizable accent color with neutral base
- Navigation: bottom tabs + swipe gestures

Color customization:
- Store accent color in user preferences
- Apply via theme context (existing themeStore pattern)
- Default palette: dark background (#1A1A2E), accent (#E94560)
- All colors must support light AND dark mode
```

## HINT 15: Self-Hosted Pi Awareness

```
The production server is a Raspberry Pi (ARM64, 16GB RAM, 1.8TB storage).

1. All Docker images MUST support linux/arm64
2. Keep sync workers lightweight — throttle loops with sleep(100) between items
3. AI runs on user's device or cloud APIs, NEVER on the server
4. Ollama base_url points to user's machine, not the server
5. Use PgBouncer (port 6432), not raw PostgreSQL connections
6. Edge Functions are replaced by a Node.js sync-worker container
7. RSS feeds use a shared cache (rss_feed_cache) — fetch each URL once
8. All external API calls should have timeouts (10s max)
9. Avoid CPU-intensive operations in hot paths (image processing, etc.)
10. Static assets served via nginx + Cloudflare cache
```

## HINT 16: Error Handling Pattern

```
Follow defensive error handling:

1. TanStack Query handles retry logic (3 retries by default)
2. Show user-friendly error messages, not raw errors
3. Never crash the app on a single feature failure
4. Widget errors are contained (error boundary per widget)
5. Network errors: show offline banner, queue mutations
6. Auth errors: redirect to login
7. API rate limits: exponential backoff with user notification
8. AI errors: show fallback (cached response or "unavailable" message)
```
