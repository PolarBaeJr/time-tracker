# 14 - Implementation Order & Dependencies

## Dependency Graph

```
Phase 1 (Foundation) ✅ DONE
├── 1A. Dashboard Hub Framework    ← Everything depends on this
│   ├── WidgetGrid, WidgetCard, WidgetRegistry
│   ├── Hub tab in navigation
│   └── Widget layout preferences
│
└── 1B. Uber-Style Theme System    ← All new UI depends on this
    ├── Color customization (accent color picker)
    ├── Dark-first design tokens
    └── Update existing theme to support customization

Phase 2 (Core Productivity) — depends on Phase 1
├── 2A. Email Integration          ← depends on 1A (widget)
│   ├── Gmail OAuth + provider
│   ├── Outlook OAuth + provider
│   ├── IMAP proxy (Edge Function)
│   ├── Email widget + full screen
│   └── AI email summarization (deferred until AI Engine in Phase 3)
│
└── 2B. Calendar Integration       ← depends on 1A (widget), existing time_entries
    ├── Google Calendar OAuth + provider
    ├── Outlook Calendar OAuth + provider
    ├── Calendar widget + views
    ├── Auto-log time from events
    └── Focus time block creation

Phase 3 (Personal Productivity + AI) — depends on Phase 1
├── 3A. AI Engine                  ← FIRST TASK — Email, Calendar, Chat, News depend on this
│   ├── Provider abstraction (Claude, OpenAI, Gemini, Ollama)
│   ├── ai_connections table + Settings UI
│   ├── OAuth + API key auth modes
│   └── Prompt templates
│
├── 3B. Notes & To-Do              ← depends on 1A (widget)
│   ├── Notes table + CRUD
│   ├── Tasks table + CRUD
│   ├── Notes/Tasks widgets
│   └── Time entry linking
│
└── 3C. AI Chat Assistant          ← depends on 3A (AI engine), 2A, 2B, 3B
    ├── Chat UI (widget + full screen)
    ├── Context system (pulls from all integrations)
    ├── Tool calling (create tasks, control timer, etc.)
    └── Suggested prompts

Phase 4 (Communication) — depends on Phase 1
├── 4A. Slack Integration          ← depends on 1A (widget)
│   ├── Slack OAuth + API
│   ├── Message list + quick reply
│   ├── Status sync with timer
│   └── Slack widget
│
├── 4B. Discord Integration        ← depends on 1A (widget)
│   ├── Discord OAuth + API
│   ├── DM list + quick reply
│   └── Discord widget
│
└── 4C. News/RSS                   ← depends on 1A (widget), 3A (AI digest)
    ├── RSS parser + Edge Function proxy
    ├── Feed management
    ├── AI daily digest
    └── News widget

Phase 5 (Utilities) — depends on Phase 1
├── 5A. Weather Widget             ← depends on 1A (widget)
├── 5B. Quick Links                ← depends on 1A (widget)
├── 5C. Clipboard Manager          ← depends on 1A (widget), Electron APIs
└── 5D. WhatsApp WebView           ← depends on 1A (widget), Electron only
```

## Build Order (Sequential Steps)

### Sprint 1: Foundation ✅ DONE
| Step | Task | Files Created/Modified | Est. Effort |
|------|------|----------------------|-------------|
| 1.1 | Create Uber-style theme tokens | `src/theme/` | Medium |
| 1.2 | Add accent color picker to Settings | `src/components/settings/` | Small |
| 1.3 | Build WidgetCard base component | `src/components/hub/WidgetCard.tsx` | Medium |
| 1.4 | Build WidgetGrid layout | `src/components/hub/WidgetGrid.tsx` | Medium |
| 1.5 | Build WidgetRegistry | `src/components/hub/WidgetRegistry.ts` | Small |
| 1.6 | Build HubScreen | `src/screens/HubScreen.tsx` | Medium |
| 1.7 | Add Hub tab to navigation | `src/navigation/MainTabs.tsx` | Small |
| 1.8 | Widget layout preferences (JSONB) | `src/hooks/useWidgetLayout.ts`, `src/stores/hubStore.ts` | Medium |
| 1.9 | Timer summary widget (proof of concept) | `src/components/hub/widgets/TimerWidget.tsx` | Small |

### Sprint 2: Email + Calendar
| Step | Task | Files Created/Modified | Est. Effort |
|------|------|----------------------|-------------|
| 2.1 | Create email migrations | `supabase/migrations/` | Small |
| 2.2 | Create calendar migrations | `supabase/migrations/` | Small |
| 2.3 | Build OAuthManager utility | `src/lib/oauth/OAuthManager.ts` | Medium |
| 2.4 | Gmail provider | `src/lib/email/providers/GmailProvider.ts` | Large |
| 2.5 | Outlook provider | `src/lib/email/providers/OutlookProvider.ts` | Large |
| 2.6 | IMAP proxy Edge Function | `supabase/functions/imap-proxy/` | Large |
| 2.7 | Email hooks | `src/hooks/useEmail.ts`, `useEmailMutations.ts` | Medium |
| 2.8 | Email widget | `src/components/hub/widgets/EmailWidget.tsx` | Medium |
| 2.9 | Email full screen | `src/screens/EmailScreen.tsx` | Large |
| 2.10 | Email compose | `src/components/email/EmailCompose.tsx` | Large |
| 2.11 | AI email summarization (stub — wired up in Phase 3 when AI Engine lands) | `src/hooks/useEmailSummary.ts` | Small |
| 2.12 | Google Calendar provider | `src/lib/calendar/providers/GoogleCalendarProvider.ts` | Large |
| 2.13 | Outlook Calendar provider | `src/lib/calendar/providers/OutlookCalendarProvider.ts` | Large |
| 2.14 | Calendar hooks | `src/hooks/useCalendar.ts` | Medium |
| 2.15 | Calendar widget | `src/components/hub/widgets/CalendarWidget.tsx` | Medium |
| 2.16 | Calendar full screen | `src/screens/CalendarScreen.tsx` | Large |
| 2.17 | Auto-log time from events | `src/lib/calendar/timeSync.ts` | Medium |
| 2.18 | Focus time block creation | `src/hooks/useCalendarSync.ts` | Medium |
| 2.19 | Extend Electron callback server | `electron/main.ts` | Medium |
| 2.20 | Email/Calendar Settings UI | `src/components/settings/` | Medium |

### Sprint 3: AI Engine + Notes + AI Chat
| Step | Task | Files Created/Modified | Est. Effort |
|------|------|----------------------|-------------|
| 3.1 | Create `ai_connections` migration | `supabase/migrations/` | Small |
| 3.2 | Build AI Engine abstraction | `src/lib/ai/` | Medium |
| 3.3 | Build AI providers (Claude, OpenAI, Gemini, Ollama) | `src/lib/ai/providers/` | Large |
| 3.4 | Build AI Settings UI (API key + OAuth modes) | `src/components/settings/AISettings.tsx` | Medium |
| 3.5 | Build AI prompt templates | `src/lib/ai/prompts/` | Medium |
| 3.6 | Create notes/tasks migrations | `supabase/migrations/` | Small |
| 3.7 | Notes CRUD hooks | `src/hooks/useNotes.ts` | Medium |
| 3.8 | Tasks CRUD hooks | `src/hooks/useTasks.ts` | Medium |
| 3.9 | Notes widget | `src/components/hub/widgets/NotesWidget.tsx` | Medium |
| 3.10 | Tasks widget | `src/components/hub/widgets/TasksWidget.tsx` | Medium |
| 3.11 | Notes full screen | `src/screens/NotesScreen.tsx` | Large |
| 3.12 | Tasks full screen | `src/screens/TasksScreen.tsx` | Large |
| 3.13 | AI task extraction | `src/lib/ai/prompts/taskExtraction.ts` | Medium |
| 3.14 | AI chat context builder | `src/lib/ai/chatContext.ts` | Medium |
| 3.15 | AI tool calling system | `src/lib/ai/tools.ts` | Large |
| 3.16 | AI chat widget | `src/components/hub/widgets/AIChatWidget.tsx` | Medium |
| 3.17 | AI chat full screen | `src/screens/AIChatScreen.tsx` | Large |

### Sprint 4: Communications + News
| Step | Task | Files Created/Modified | Est. Effort |
|------|------|----------------------|-------------|
| 4.1 | Create communication migrations | `supabase/migrations/` | Small |
| 4.2 | Create RSS migrations | `supabase/migrations/` | Small |
| 4.3 | Slack OAuth + Edge Function | `supabase/functions/slack-oauth/` | Medium |
| 4.4 | Slack provider | `src/lib/communications/SlackProvider.ts` | Large |
| 4.5 | Slack widget | `src/components/hub/widgets/SlackWidget.tsx` | Medium |
| 4.6 | Discord OAuth + Edge Function | `supabase/functions/discord-oauth/` | Medium |
| 4.7 | Discord provider | `src/lib/communications/DiscordProvider.ts` | Large |
| 4.8 | Discord widget | `src/components/hub/widgets/DiscordWidget.tsx` | Medium |
| 4.9 | Status sync (Slack/Discord) | `src/lib/communications/statusSync.ts` | Medium |
| 4.10 | RSS parser + Edge Function | `supabase/functions/fetch-rss/` | Medium |
| 4.11 | RSS hooks | `src/hooks/useFeeds.ts` | Medium |
| 4.12 | AI daily digest | `src/hooks/useAIDigest.ts` | Medium |
| 4.13 | News widget | `src/components/hub/widgets/NewsWidget.tsx` | Medium |
| 4.14 | News full screen | `src/screens/NewsScreen.tsx` | Large |

### Sprint 5: Utilities
| Step | Task | Files Created/Modified | Est. Effort |
|------|------|----------------------|-------------|
| 5.1 | Weather widget | `src/components/hub/widgets/WeatherWidget.tsx` | Small |
| 5.2 | Quick links migration + CRUD | `supabase/migrations/`, `src/hooks/useQuickLinks.ts` | Small |
| 5.3 | Quick links widget | `src/components/hub/widgets/QuickLinksWidget.tsx` | Small |
| 5.4 | Clipboard watcher (Electron) | `electron/clipboardWatcher.ts` | Medium |
| 5.5 | Clipboard widget | `src/components/hub/widgets/ClipboardWidget.tsx` | Medium |
| 5.6 | WhatsApp webview widget | `src/components/hub/widgets/WhatsAppWidget.tsx` | Medium |

---

## Configuration for Conductor

```
Concurrency: 5 parallel workers
Worker Runtime: Claude Code (Opus for orchestration, Sonnet 4.6 for coding)
Max Cycles: 5
Skip Codex: No
Dry Run: No (but Phase 1 must be approved before coding starts)
```

## Testing Strategy

Each sprint includes:
1. Unit tests for new hooks and utilities
2. Integration tests for OAuth flows (mocked)
3. Widget rendering tests
4. Manual testing on Web + Electron + iOS simulator
5. Security review of token handling
6. No regression testing breakage of existing features (run full test suite)
