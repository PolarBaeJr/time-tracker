# 04 - Calendar Integration

## Phase: 2 (Core Productivity)

## Summary

Two-way calendar sync with Google Calendar and Outlook Calendar. View events, create/edit/delete, auto-log time from meetings, and block focus time when starting pomodoro sessions.

## Features

1. **View Events** - Today's schedule + weekly view in hub widget
2. **Create/Edit/Delete Events** - Full CRUD from within the app
3. **Auto-Log Time** - Create time entries from calendar events (with confirmation)
4. **Focus Time Blocks** - Create calendar blocks when starting pomodoro/focus sessions
5. **Meeting Prep** - AI generates prep notes from event details and attendees
6. **Multi-calendar** - Support multiple calendars per provider

## Architecture

```
src/
  lib/
    calendar/
      CalendarEngine.ts        # Abstraction over providers
      providers/
        GoogleCalendarProvider.ts
        OutlookCalendarProvider.ts
      types.ts                 # Event, Calendar, Attendee types
      timeSync.ts              # Calendar <-> TimeEntry sync logic
  hooks/
    useCalendar.ts             # Calendar queries
    useCalendarMutations.ts    # Create/edit/delete events
    useCalendarSync.ts         # Auto-log time entries
  components/
    calendar/
      CalendarWidget.tsx       # Hub widget (today's events)
      CalendarDayView.tsx      # Full day view
      CalendarWeekView.tsx     # Week view
      EventCard.tsx            # Single event display
      EventEditor.tsx          # Create/edit event modal
      AutoLogPrompt.tsx        # "Log this meeting as time?" prompt
    settings/
      CalendarSettings.tsx     # Connect/disconnect calendars
```

## Provider Implementations

### Google Calendar

**OAuth Flow:**
- Scopes: `calendar.readonly`, `calendar.events` (for two-way), `calendar.settings.readonly`
- Reuse existing Google OAuth if user already signed in with Google (request additional scopes)
- Token stored in `calendar_connections` table

**API Endpoints:**
- `GET /calendars/{id}/events` - List events
- `POST /calendars/{id}/events` - Create event
- `PUT /calendars/{id}/events/{eventId}` - Update event
- `DELETE /calendars/{id}/events/{eventId}` - Delete event
- `GET /users/me/calendarList` - List calendars

### Outlook Calendar

**OAuth Flow:**
- Scopes: `Calendars.Read`, `Calendars.ReadWrite`
- Token stored in `calendar_connections` table

**API Endpoints:**
- `GET /me/events` - List events
- `POST /me/events` - Create event
- `PATCH /me/events/{id}` - Update event
- `DELETE /me/events/{id}` - Delete event
- `GET /me/calendars` - List calendars

## Database Schema

```sql
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL,          -- 'google' | 'outlook'
  account_email TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  selected_calendars TEXT[],       -- Calendar IDs user wants to see
  sync_token TEXT,                 -- For incremental sync
  last_sync_at TIMESTAMPTZ,
  auto_log_enabled BOOLEAN DEFAULT false,
  focus_block_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, account_email)
);

CREATE TABLE calendar_events_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  connection_id UUID REFERENCES calendar_connections NOT NULL,
  event_id TEXT NOT NULL,           -- Provider's event ID
  calendar_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  attendees JSONB,                  -- [{email, name, status}]
  organizer TEXT,
  status TEXT,                      -- confirmed | tentative | cancelled
  recurrence_rule TEXT,
  time_entry_id UUID REFERENCES time_entries, -- Linked time entry (if auto-logged)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, event_id)
);

-- RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_connections" ON calendar_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_events" ON calendar_events_cache FOR ALL USING (auth.uid() = user_id);
```

## Time Tracking Integration

### Auto-Log Time from Events

When enabled, after a calendar event ends:
1. Show notification: "Log 'Team Standup' (30 min) as time entry?"
2. User confirms or dismisses
3. If confirmed, create time_entry with:
   - `start_at` = event start
   - `end_at` = event end
   - `notes` = event title + description
   - `category_id` = user's default meeting category (or let them pick)
4. Link the time_entry to calendar_event via `time_entry_id`

### Focus Time Blocks

When user starts a pomodoro or focus session:
1. Check if focus_block_enabled
2. Create a calendar event: "Focus Time - [Category Name]"
3. Duration matches pomodoro settings (e.g., 25 min work)
4. Set status to "busy" so colleagues see you're unavailable
5. On timer stop, update event end time to actual end

### Meeting Prep (AI)

For upcoming events (next 24h):
1. AI reads event title, description, attendees
2. Generates: key topics, questions to prepare, relevant context
3. Shows as a card in the calendar widget or event detail view

## Calendar Widget (Hub)

```
+---------------------------------------+
|  Today's Schedule             Mar 10  |
|  ─────────────────────────────────── |
|  09:00  Team Standup        30m  📹  |
|  10:30  1:1 with Sarah      45m  📹  |
|  ─── Now ─────────────────────────── |
|  14:00  Sprint Review       1h   📹  |
|  ─────────────────────────────────── |
|  [+ New Event]      [View Week]      |
+---------------------------------------+
```

## Sync Strategy

- **Initial sync**: Fetch events for current month + next month
- **Incremental sync**: Use sync tokens (Google: `syncToken`, Outlook: `deltaLink`)
- **Poll interval**: Every 5 minutes
- **Push notifications**: Google Calendar supports webhooks (requires public URL)
- **Conflict resolution**: Server wins (calendar provider is source of truth)
