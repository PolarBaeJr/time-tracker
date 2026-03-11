# 10 - Security Audit & Vulnerability Prevention

## Current Codebase Security Assessment

### Existing Strengths
1. **RLS on all tables** - Users can only access their own data
2. **Context isolation** in Electron (nodeIntegration=false, contextBridge)
3. **PKCE flow** for OAuth (Spotify, Google)
4. **Soft deletes** prevent accidental data loss
5. **user_id set via DEFAULT auth.uid()** - never sent from client

### Existing Vulnerabilities Found

#### HIGH: Spotify Client ID Hardcoded
- **File**: `src/lib/spotify.ts`
- **Issue**: `SPOTIFY_CLIENT_ID = '7e7804a0fde74453bbf88a37aee4698d'` is embedded in source
- **Risk**: Client ID exposure (low risk for PKCE flow, but bad practice)
- **Fix**: Move to environment variable `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`

#### HIGH: OAuth Callback Server on Localhost
- **File**: `electron/main.ts`
- **Issue**: HTTP server on `127.0.0.1:54321` for OAuth callbacks
- **Risk**: Other local apps could intercept callbacks or race condition on port binding
- **Fix**: Use random port with IPC, or use custom protocol handler (`worktracker://`)

#### MEDIUM: Token Storage in localStorage (Web/Electron)
- **File**: `src/lib/supabase.ts`, Spotify token handling
- **Issue**: OAuth tokens in localStorage are accessible to XSS
- **Risk**: If any XSS vulnerability exists, tokens are compromised
- **Fix**: HttpOnly cookies for session (requires Supabase config change), or encrypted localStorage

#### MEDIUM: No CSRF Protection on OAuth Callbacks
- **File**: `src/navigation/index.tsx`
- **Issue**: Spotify OAuth state stored in sessionStorage but validation could be stronger
- **Risk**: CSRF attacks on OAuth flow
- **Fix**: Use cryptographically random state with server-side validation

#### LOW: Debug Logging in Production
- **File**: `src/navigation/index.tsx` (spotifyDebug function)
- **Issue**: Debug logs written to localStorage in production
- **Risk**: Information disclosure
- **Fix**: Gate behind `__DEV__` flag

#### LOW: No Rate Limiting on Client
- **Issue**: No client-side rate limiting on API calls
- **Risk**: Accidental DoS of Supabase or external APIs
- **Fix**: Add request throttling/debouncing

---

## New Integration Security Risks

### 1. API Key Storage (AI Engine)

**Risk**: User API keys (Claude, OpenAI) stored in Supabase
**Threat**: Database breach exposes all user API keys
**Mitigation** (IMPLEMENTED):
- **Server-side encryption** via Supabase Edge Functions (`encrypt-api-key`, `decrypt-api-key`)
- Encryption key stored as Supabase secret (`ENCRYPTION_KEY`) - never exposed to client
- Uses AES-256-GCM with per-user key derivation (HKDF from master key + user ID)
- Client sends API keys over HTTPS to Edge Function for encryption
- Database stores only encrypted keys
- Never log API keys in error messages
- Mask keys in UI (show only last 4 chars)
- Implement key rotation reminders

**Setup Required**:
1. Generate encryption key: `openssl rand -base64 32`
2. Set as Supabase secret: `supabase secrets set ENCRYPTION_KEY="your-key"`
3. Deploy edge functions: `supabase functions deploy`

### 2. Email Content Storage

**Risk**: Email content cached in Supabase = sensitive data at rest
**Threat**: Database breach exposes email contents
**Mitigation**:
- Store only metadata + snippets in Supabase, not full email bodies
- Full email body fetched on-demand from provider API (never cached server-side)
- AI summaries are okay to cache (they don't contain raw email content)
- Implement auto-purge of email cache older than 7 days
- RLS ensures user isolation

### 3. OAuth Token Sprawl

**Risk**: Multiple OAuth tokens (Gmail, Outlook, Slack, Discord, Calendar) all stored in DB
**Threat**: Single breach = access to all user's connected services
**Mitigation**:
- Encrypt all tokens with per-user key
- Request minimal scopes (principle of least privilege)
- Implement token expiry monitoring and auto-revocation
- Add "connected services" audit page in Settings
- Allow users to revoke any connection instantly
- Log all token refreshes for audit

### 4. IMAP Credential Handling

**Risk**: IMAP requires storing raw username/password (not OAuth)
**Threat**: Credentials stored in DB, potentially reused passwords
**Mitigation**:
- Strong encryption for IMAP credentials
- Warn users about password reuse
- Recommend app-specific passwords
- IMAP proxy must use TLS exclusively
- Never log IMAP credentials

### 5. Cross-Site Scripting (XSS) via Email Content

**Risk**: Rendering HTML email content in the app
**Threat**: Malicious emails with embedded JavaScript
**Mitigation**:
- Sanitize all HTML email content with DOMPurify
- Strip `<script>`, `<iframe>`, `on*` attributes
- Render emails in sandboxed iframe (web) or WebView (mobile)
- CSP headers on email rendering context
- Never render email HTML in the main app context

### 6. RSS Feed Injection

**Risk**: RSS feeds from arbitrary URLs
**Threat**: Malicious feed content (XSS, SSRF via proxy)
**Mitigation**:
- Sanitize all RSS content before rendering
- RSS proxy (Edge Function) must validate URLs and block private IPs (SSRF prevention)
- Rate limit feed fetching per user
- Validate feed format before parsing

### 7. Clipboard Data Leakage

**Risk**: Clipboard manager captures sensitive data (passwords, tokens)
**Threat**: Sensitive clipboard data exposed if device compromised
**Mitigation**:
- Never sync clipboard to server
- Auto-detect and skip password-like patterns
- Auto-clear items after 24 hours
- User can clear all history instantly
- Exclude clipboard from app backups

### 8. AI Prompt Injection

**Risk**: User data (emails, notes, calendar events) injected into AI prompts
**Threat**: Malicious email content could manipulate AI behavior
**Mitigation**:
- Separate user data from system instructions clearly
- Use structured prompts with clear delimiters
- Validate AI tool call outputs before execution
- Rate limit AI-triggered actions (e.g., max 5 tasks created per AI conversation)
- Never let AI execute destructive actions without user confirmation

### 9. WebSocket Security (Slack/Discord)

**Risk**: Real-time connections to Slack/Discord
**Threat**: Token hijacking, man-in-the-middle
**Mitigation**:
- All WebSocket connections must use WSS (TLS)
- Validate WebSocket messages against expected schemas
- Implement reconnection with fresh tokens
- Rate limit incoming messages

### 10. WhatsApp WebView Risks

**Risk**: Embedded WhatsApp Web in webview
**Threat**: Session hijacking, data exfiltration from webview
**Mitigation**:
- Isolate WebView with separate partition (no shared cookies)
- Disable JavaScript bridge (no communication between webview and app)
- Clear webview data on disconnect
- Warn users about session persistence

---

## Security Checklist for Each New Feature

- [ ] All new tables have RLS enabled
- [ ] All tokens encrypted before storage
- [ ] Minimal OAuth scopes requested
- [ ] All user input sanitized before rendering
- [ ] No secrets in client-side code
- [ ] Error messages don't leak sensitive info
- [ ] Rate limiting on external API calls
- [ ] Audit logging for security events
- [ ] Auto-cleanup of cached sensitive data
- [ ] HTTPS/TLS for all external connections
