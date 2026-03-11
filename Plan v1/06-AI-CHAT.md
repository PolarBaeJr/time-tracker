# 06 - AI Chat Assistant

## Phase: 3 (Personal Productivity)

## Summary

A contextual AI assistant that understands your time tracking data, emails, calendar, and tasks. It can summarize emails, analyze productivity, prepare for meetings, create tasks, and answer general questions.

## Features

1. **General Chat** - Ask anything, get AI responses with streaming
2. **Email Summarization** - "Summarize my unread emails" / "What does the Acme thread say?"
3. **Time Insights** - "How much did I work this week?" / "What's my most productive day?"
4. **Meeting Prep** - "Prep me for my 2pm meeting" (pulls calendar + attendee info)
5. **Smart Task Creation** - "Remind me to call Sarah tomorrow"
6. **Context Awareness** - AI sees your current timer state, today's schedule, pending tasks

## Architecture

```
src/
  components/
    ai/
      AIChatWidget.tsx        # Hub widget (quick prompt bar)
      AIChatScreen.tsx        # Full chat screen
      AIChatMessage.tsx       # Single message bubble
      AIChatInput.tsx         # Input with suggestions
      AIChatSuggestions.tsx   # Quick action chips
  hooks/
    useAIChat.ts              # Chat state management
    useAIChatContext.ts       # Gathers context for AI
  lib/
    ai/
      chatContext.ts          # Build context from user's data
      tools.ts                # AI tool definitions (function calling)
```

## Context System

The AI assistant gets context injected into its system prompt:

```typescript
interface ChatContext {
  // Time tracking
  currentTimer: { running: boolean; category: string; elapsed: string } | null;
  todayHours: number;
  weekHours: number;

  // Calendar
  todayEvents: { title: string; time: string; attendees: string[] }[];
  nextEvent: { title: string; in: string } | null;

  // Tasks
  pendingTasks: { title: string; due: string; priority: number }[];
  overdueCount: number;

  // Email (if connected)
  unreadCount: number;
  recentEmails: { subject: string; from: string; snippet: string }[];
}
```

This context is refreshed before each message and included as a system prompt prefix.

## AI Tool Calling

The AI can execute actions via function calling:

```typescript
const aiTools = [
  {
    name: 'start_timer',
    description: 'Start the time tracker with an optional category',
    parameters: { category_name: 'string?' }
  },
  {
    name: 'stop_timer',
    description: 'Stop the current timer',
    parameters: { notes: 'string?' }
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    parameters: { title: 'string', due_at: 'string?', priority: 'number?', category: 'string?' }
  },
  {
    name: 'summarize_emails',
    description: 'Summarize unread or recent emails',
    parameters: { count: 'number?', filter: 'string?' }
  },
  {
    name: 'get_schedule',
    description: 'Get calendar events for a date range',
    parameters: { date: 'string?', days: 'number?' }
  },
  {
    name: 'get_time_report',
    description: 'Get time tracking report',
    parameters: { period: "'today' | 'week' | 'month'", category: 'string?' }
  },
  {
    name: 'create_note',
    description: 'Create a quick note',
    parameters: { title: 'string?', content: 'string' }
  }
];
```

## Chat UI

### Widget (Hub) - Compact
```
+---------------------------------------+
|  AI Assistant                    ⚡    |
|  ─────────────────────────────────── |
|  [Summarize emails] [Today's plan]    |
|  [How's my week?]  [Prep meeting]     |
|  ─────────────────────────────────── |
|  Ask anything...                 [→]  |
+---------------------------------------+
```

### Full Screen Chat
```
+---------------------------------------+
|  AI Assistant                    ⚙    |
|  ─────────────────────────────────── |
|  You: How much did I work this week?  |
|                                       |
|  AI: You've logged 32.5 hours this    |
|  week across 4 categories:            |
|  • Development: 18h (55%)             |
|  • Meetings: 8h (25%)                 |
|  • Design: 4h (12%)                   |
|  • Admin: 2.5h (8%)                   |
|                                       |
|  You're on track for your 40h weekly  |
|  goal. Your most productive day was   |
|  Tuesday (8.5h).                      |
|  ─────────────────────────────────── |
|  Ask anything...                 [→]  |
+---------------------------------------+
```

## Chat History

Conversations stored locally (not in Supabase) for privacy:
- AsyncStorage on mobile
- localStorage on web/Electron
- Last 50 conversations retained
- User can clear history

## Suggested Prompts

Contextual suggestions based on time of day and state:
- Morning: "Summarize my emails", "What's on my calendar today?"
- Active timer: "How long have I been working?", "What should I focus on next?"
- End of day: "Summarize my day", "What's left on my task list?"
- Before meeting: "Prep me for [next meeting]"
