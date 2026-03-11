# Conversation Log: Plan v1 Creation
**Date**: 2026-03-10

## Summary
Created comprehensive Plan v1 for transforming WorkTracker into a unified daily productivity hub. 16 documents covering 13 features across 5 phases.

## Key Decisions Made

### Feature Selections
- **Integrations chosen**: Email (Gmail/Outlook/IMAP), Calendar (Google/Outlook), Notes & To-Do, Weather, AI Chat, Slack, Discord, WhatsApp, News/RSS, Quick Links, Clipboard Manager
- **Email depth**: Full client (read + AI summary + compose + reply + search)
- **Calendar depth**: Full two-way sync + auto-log time from events + focus time blocks
- **Chat integrations**: Notifications + quick reply (not full replacement)
- **News/RSS**: AI daily digest + topic filtering
- **Weather**: Simple card, expandable 3-day forecast

### Architecture Decisions
- **AI Provider**: Multi-provider (Claude, OpenAI, Ollama) — user picks and enters own API key
- **Ollama**: Runs on user's own device, NOT on the server. App connects to user's local `http://localhost:11434`
- **Token storage**: Encrypted in Supabase DB (matching existing spotify_connections pattern)
- **Auth model**: Per-service OAuth (each service has connect/disconnect in Settings)
- **UI layout**: Uber-style design, dark-first, user-customizable accent colors
- **Platforms**: All features on Web, Electron, iOS, Android

### Hosting & Scaling
- **Server**: Raspberry Pi — 16GB RAM, 1.8TB storage
- **Architecture**: Self-hosted Supabase via Docker (already partially set up)
- **Key additions needed**:
  - PgBouncer (mandatory for connection pooling on Pi)
  - Cloudflare Tunnel (free SSL, caching, hides home IP)
  - Priority-based sync queue (active users sync first)
  - Sync-worker as Node.js container (replaces Edge Functions)
- **Capacity estimate**: 1,000-3,000 users comfortably on Pi
- **Storage**: ~82GB for 10K users — 1.8TB is more than enough
- **CPU**: Only bottleneck, but AI runs elsewhere so manageable

### Scaling Analysis
- Supabase hosted caps at ~500 active users with all integrations
- Self-hosted on Pi removes connection/storage/channel limits
- IMAP proxy works better as a sidecar container on self-hosted
- RSS feeds need shared cache to deduplicate across users
- Gmail/Outlook should use webhooks (push) not polling at scale
- Ollama = zero server load (runs on user's machine)

### Implementation Config
- **Concurrency**: 5 parallel workers
- **Orchestration**: Opus for thinking/planning
- **Coding**: Sonnet 4.6
- **Codex review**: Enabled
- **Max cycles**: 5

## Q&A Record

Q1: Which daily-use integrations?
A1: Email, Calendar, Notes/To-Do, Weather, + more daily items like news summary

Q2: Additional productivity integrations?
A2: AI Chat, Quick Links, Clipboard Manager, News/RSS

Q3: Communication integrations?
A3: Slack, Discord, WhatsApp

Q4: AI provider?
A4: Multi-provider AND local LLM (Ollama) as option

Q5: UI layout?
A5: Dashboard Hub (new tab with customizable widget grid)

Q6: Email providers at launch?
A6: Gmail, Outlook, IMAP Generic

Q7: Email interaction level?
A7: Read + AI summary AND full client

Q8: Auth model?
A8: Per-service OAuth (like existing Spotify pattern)

Q9: Token storage?
A9: Supabase DB (like Spotify)

Q10: AI Chat capabilities?
A10: All — email summarization, time insights, meeting prep, smart task creation

Q11: Calendar integration depth?
A11: All — view, auto-log time, focus blocks, two-way sync

Q12: Implementation priority?
A12: Full plan, let me (Claude) decide optimal phases

Q13: Platform support?
A13: All platforms (Web, Electron, iOS, Android)

Q14: Slack/Discord depth?
A14: Notifications + quick reply

Q15: News AI features?
A15: Daily digest + topic filtering

Q16: Weather detail?
A16: Simple card (expandable)

Q17: UI style?
A17: Uber layout, customizable colors

Q18: Concurrency?
A18: 5 workers

## Documents Created
All in `/Plan v1/`:
- 00-OVERVIEW.md — Master plan
- 01-DASHBOARD-HUB.md — Widget framework
- 02-AI-ENGINE.md — Multi-provider AI
- 03-EMAIL.md — Email integration
- 04-CALENDAR.md — Calendar integration
- 05-NOTES-TODO.md — Notes & tasks
- 06-AI-CHAT.md — AI assistant
- 07-COMMUNICATIONS.md — Slack, Discord, WhatsApp
- 08-NEWS-RSS.md — News/RSS with AI digest
- 09-UTILITIES.md — Weather, links, clipboard
- 10-SECURITY-AUDIT.md — Security vulnerabilities + mitigations
- 11-AGENT-HINTS.md — 15 hints for coding agents
- 12-DATABASE-SCHEMA.md — All new SQL tables
- 13-AUTH-CONNECTIONS.md — OAuth flows per service
- 14-IMPLEMENTATION-ORDER.md — Build order + dependencies
- 15-UI-DESIGN-SYSTEM.md — Uber-style design system

## Updates After Initial Plan
- Added `16-HOSTING-SCALING.md` with full Pi architecture, PgBouncer, Cloudflare Tunnel, sync-worker, RAM allocation, storage projections
- Updated `02-AI-ENGINE.md` to clarify Ollama runs on user's device, not server
- Updated `11-AGENT-HINTS.md` with HINT 15 for Pi-specific coding guidance
- Updated `00-OVERVIEW.md` index with new documents
- User clarified: Uber-style layout with customizable colors (captured in `15-UI-DESIGN-SYSTEM.md`)

## Additional Updates
- Added `17-TOKEN-AUTO-REFRESH.md` — unified auto-refresh system:
  - Client-side TokenManager singleton schedules refresh 5 min before expiry
  - Server-side sync-worker refreshes tokens every 10 min for background sync
  - UI notification when a token permanently expires ("Reconnect" banner)
  - Migration path: Spotify stays as-is initially, migrated to TokenManager in Phase 2
  - Token lifetimes documented per provider (Google=1h, Slack=no expiry, Discord=7d)

## Open Items / Next Steps
- User to approve plan before implementation begins
- All 18 documents complete in Plan v1
