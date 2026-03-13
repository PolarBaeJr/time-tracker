# WorkTracker Hub - Master Plan v1

## Vision

Transform WorkTracker from a time-tracking app into a **unified daily productivity hub** that minimizes app-switching by consolidating the tools people use every day into a single, beautifully integrated interface.

## Core Principle

**Do not break existing functionality.** Every new feature is additive. The current timer, analytics, categories, goals, history, and Spotify integration remain untouched. New features plug into a new "Hub" tab and extend the existing architecture.

## Architecture Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React Native + Expo + Electron | All platforms: Web, Desktop, iOS, Android |
| Backend | Supabase (PostgreSQL + Auth + Realtime) | RLS on all tables |
| AI Engine | Multi-provider (Claude, OpenAI, Ollama) | User chooses provider + enters API key |
| State | TanStack Query + Zustand | Server state + client state |
| Auth per service | OAuth2 / API keys | Per-service connect/disconnect in Settings |
| Token storage | Supabase DB (like spotify_connections) | RLS-protected, encrypted at rest |

## Feature List

| # | Feature | Phase | Priority |
|---|---------|-------|----------|
| 1 | Dashboard Hub (widget framework) | 1 | Critical |
| 2 | AI Engine (multi-provider) | 3 | Critical |
| 3 | Email Integration (Gmail, Outlook, IMAP) | 2 | High |
| 4 | Calendar Integration (Google, Outlook) | 2 | High |
| 5 | Notes & To-Do List | 3 | High |
| 6 | AI Chat Assistant | 3 | High |
| 7 | Slack Integration | 4 | Medium |
| 8 | Discord Integration | 4 | Medium |
| 9 | News/RSS with AI Digest | 4 | Medium |
| 10 | Weather Widget | 5 | Low |
| 11 | Quick Links / Bookmarks | 5 | Low |
| 12 | Clipboard Manager | 5 | Low |
| 13 | WhatsApp Web View | 5 | Low |

## Implementation Phases

### Phase 1: Foundation (Hub + Theme) ✅ DONE
Built the widget framework and theme system. Everything else depends on these.

### Phase 2: Core Productivity (Email + Calendar)
The highest-impact daily features. Email with AI summarization and calendar with time-tracking sync.

### Phase 3: Personal Productivity (AI Engine + Notes + AI Chat)
AI Engine (multi-provider abstraction) built first, then task management and an AI assistant that understands your time data, emails, and calendar.

### Phase 4: Communication (Slack + Discord + News)
Reduce messaging app-switching with notification + quick reply integrations.

### Phase 5: Utilities (Weather + Links + Clipboard + WhatsApp)
Quality-of-life widgets that round out the hub experience.

## Documents in This Plan

| File | Description |
|------|-------------|
| `00-OVERVIEW.md` | This file - master plan overview |
| `01-DASHBOARD-HUB.md` | Widget framework architecture |
| `02-AI-ENGINE.md` | Multi-provider AI abstraction layer |
| `03-EMAIL.md` | Email integration (Gmail, Outlook, IMAP) |
| `04-CALENDAR.md` | Calendar integration with time-tracking sync |
| `05-NOTES-TODO.md` | Notes and task management |
| `06-AI-CHAT.md` | AI Chat Assistant with contextual awareness |
| `07-COMMUNICATIONS.md` | Slack, Discord, WhatsApp integrations |
| `08-NEWS-RSS.md` | News/RSS feed with AI digest |
| `09-UTILITIES.md` | Weather, Quick Links, Clipboard Manager |
| `10-SECURITY-AUDIT.md` | Security analysis and vulnerability prevention |
| `11-AGENT-HINTS.md` | Hints for coding agents to avoid issues |
| `12-DATABASE-SCHEMA.md` | All new tables, RLS policies, migrations |
| `13-AUTH-CONNECTIONS.md` | OAuth flows for every service |
| `14-IMPLEMENTATION-ORDER.md` | Exact build order with dependencies |
| `15-UI-DESIGN-SYSTEM.md` | Uber-style layout + customizable accent colors |
| `16-HOSTING-SCALING.md` | Raspberry Pi self-hosted architecture + scaling |
| `17-TOKEN-AUTO-REFRESH.md` | Unified token auto-refresh system (client + server) |
