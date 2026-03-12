# API Reference

WorkTracker uses Supabase as its backend. All data access goes through the Supabase JavaScript client with Row Level Security (RLS) enforced at the database level.

## Tables

### `public.users`

User profiles, synced from `auth.users` via trigger on first sign-in.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, matches `auth.users.id` |
| `email` | `text` | User's email address |
| `name` | `text` | Display name |
| `timezone` | `text` | IANA timezone (e.g. `America/New_York`) |
| `week_start_day` | `int` | 0 = Sunday, 1 = Monday |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Last update time (auto-updated by trigger) |

**RLS:** Users can only read and update their own row.

---

### `public.categories`

User-defined categories for organizing time entries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Owner (defaults to `auth.uid()`) |
| `name` | `text` | Category name (max 100 chars) |
| `color` | `text` | Hex color code (e.g. `#6366F1`) |
| `type` | `text` | One of: `work`, `personal`, `hobby` |
| `created_at` | `timestamptz` | Row creation time |

**RLS:** Users can only read, insert, update, and delete their own categories. `user_id` is set automatically from `auth.uid()` and cannot be overridden.

---

### `public.time_entries`

Completed time tracking records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Owner (defaults to `auth.uid()`) |
| `category_id` | `uuid?` | FK to `categories.id` (nullable) |
| `start_at` | `timestamptz` | When the tracked period started |
| `end_at` | `timestamptz` | When the tracked period ended |
| `duration_seconds` | `int` | Pre-calculated duration (seconds) |
| `notes` | `text?` | Optional description |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Last update time (auto-updated) |

**RLS:** Users can only access their own entries.

---

### `public.active_timers`

One row per user while a timer is running. Unique constraint: one timer per user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Owner (defaults to `auth.uid()`); **unique** |
| `category_id` | `uuid?` | FK to `categories.id` (nullable) |
| `started_at` | `timestamptz` | Server timestamp when timer started (DEFAULT `now()`) |
| `running` | `bool` | Always `true` while active |

**RLS:** Users can only access their own timer row.

**Important:** `started_at` is set by the database DEFAULT. Never send it from the client.

---

### `public.monthly_goals`

Monthly time targets, optionally scoped to a category.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Owner (defaults to `auth.uid()`) |
| `month` | `date` | First day of the target month (e.g. `2024-03-01`) |
| `category_id` | `uuid?` | FK to `categories.id` (nullable = overall goal) |
| `target_hours` | `numeric` | Target hours for the month |

**RLS:** Users can only access their own goals.

---

## RPC Functions

### `stop_timer_and_create_entry(p_notes text)`

Atomically stops the caller's active timer and creates a corresponding `time_entries` row.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_notes` | `text` | Optional notes for the time entry |

**Returns:** `uuid` — the ID of the newly created time entry.

**Errors:** Raises an exception if no active timer exists for the caller.

**Usage:**

```typescript
const { data: entryId, error } = await supabase.rpc('stop_timer_and_create_entry', {
  p_notes: 'Working on feature X',
});
```

---

## Realtime Subscriptions

The `active_timers` table has Realtime enabled. Subscribe to changes:

```typescript
const channel = supabase
  .channel('active-timer')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'active_timers',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      // payload.new contains the updated row
      // payload.eventType is INSERT | UPDATE | DELETE
    }
  )
  .subscribe();
```

---

---

### `public.email_connections`

OAuth and IMAP connections for email integration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Owner (defaults to `auth.uid()`) |
| `provider` | `text` | One of: `gmail`, `outlook`, `imap` |
| `access_token_encrypted` | `text?` | Encrypted OAuth access token |
| `refresh_token_encrypted` | `text?` | Encrypted OAuth refresh token |
| `expires_at` | `timestamptz?` | OAuth token expiration time |
| `imap_server` | `text?` | IMAP server hostname (for IMAP provider) |
| `imap_port` | `int?` | IMAP server port (for IMAP provider) |
| `imap_username` | `text?` | IMAP username (for IMAP provider) |
| `imap_password_encrypted` | `text?` | Encrypted IMAP password |
| `email_address` | `text` | Connected email address |
| `is_active` | `bool` | Whether the connection is active |
| `last_sync_at` | `timestamptz?` | Last successful sync time |
| `sync_error` | `text?` | Last sync error message |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Last update time (auto-updated) |

**RLS:** Users can only access their own email connections.

**Unique constraint:** `(user_id, email_address)` — one connection per email address per user.

---

### `public.email_messages`

Cached email messages from connected accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `connection_id` | `uuid` | FK to `email_connections.id` (CASCADE delete) |
| `provider_id` | `text` | Message ID from the email provider |
| `subject` | `text?` | Email subject line |
| `sender` | `text` | Sender email address |
| `sender_name` | `text?` | Sender display name |
| `received_at` | `timestamptz` | When the email was received |
| `snippet` | `text?` | Preview snippet (max 200 chars) |
| `is_read` | `bool` | Whether the email has been read |
| `is_starred` | `bool` | Whether the email is starred/flagged |
| `labels` | `text[]` | Email labels/categories |
| `ai_summary` | `text?` | AI-generated summary |
| `created_at` | `timestamptz` | Row creation time |

**RLS:** Users can only access messages from their own connections.

**Unique constraint:** `(connection_id, provider_id)` — prevents duplicate messages.

**Indexes:** `connection_id`, `received_at DESC`, partial index on unread messages.

---

### `public.calendar_connections`

OAuth connections for calendar integration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Owner (defaults to `auth.uid()`) |
| `provider` | `text` | One of: `google`, `outlook` |
| `access_token_encrypted` | `text?` | Encrypted OAuth access token |
| `refresh_token_encrypted` | `text?` | Encrypted OAuth refresh token |
| `expires_at` | `timestamptz?` | OAuth token expiration time |
| `calendar_id` | `text?` | Selected calendar ID (default: primary) |
| `email_address` | `text` | Connected account email |
| `is_active` | `bool` | Whether the connection is active |
| `last_sync_at` | `timestamptz?` | Last successful sync time |
| `sync_error` | `text?` | Last sync error message |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Last update time (auto-updated) |

**RLS:** Users can only access their own calendar connections.

**Unique constraint:** `(user_id, provider, email_address)` — one connection per provider per email per user.

---

### `public.calendar_events`

Cached calendar events from connected accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `connection_id` | `uuid` | FK to `calendar_connections.id` (CASCADE delete) |
| `provider_id` | `text` | Event ID from the calendar provider |
| `title` | `text?` | Event title/summary |
| `description` | `text?` | Event description |
| `location` | `text?` | Event location |
| `start_at` | `timestamptz` | Event start time |
| `end_at` | `timestamptz` | Event end time |
| `is_all_day` | `bool` | Whether it's an all-day event |
| `status` | `text?` | One of: `confirmed`, `tentative`, `cancelled` |
| `organizer` | `text?` | Organizer email address |
| `attendees` | `jsonb?` | Array of attendee objects |
| `recurrence` | `text?` | Recurrence rule (if recurring) |
| `ai_summary` | `text?` | AI-generated summary |
| `created_at` | `timestamptz` | Row creation time |

**RLS:** Users can only access events from their own connections.

**Unique constraint:** `(connection_id, provider_id)` — prevents duplicate events.

**Indexes:** `connection_id`, `start_at`, composite index for date range queries.

---

## Edge Functions

### `POST /email-sync`

Syncs emails from a connected Gmail or Outlook account.

**Authentication:** Requires valid Supabase JWT in `Authorization` header.

**Request body:**
```json
{
  "connectionId": "uuid"
}
```

**Success response (200):**
```json
{
  "success": true,
  "messageCount": 42,
  "syncedAt": "2024-01-15T10:30:00.000Z"
}
```

**Rate limited response (429):**
```json
{
  "success": false,
  "error": "Sync cooldown in effect. Please wait 180 seconds.",
  "retryAfter": 180
}
```

**Behavior:**
- 5-minute sync cooldown between syncs
- Automatically refreshes tokens if expired
- Upserts up to 50 messages per sync
- IMAP connections are not supported (returns 400)

---

### `POST /calendar-sync`

Syncs calendar events from a connected Google Calendar or Outlook account.

**Authentication:** Requires valid Supabase JWT in `Authorization` header.

**Request body:**
```json
{
  "connectionId": "uuid",
  "dateRange": {
    "start": "2024-01-15T00:00:00.000Z",
    "end": "2024-01-29T23:59:59.999Z"
  }
}
```

The `dateRange` parameter is optional. Default: today + 14 days.

**Success response (200):**
```json
{
  "success": true,
  "eventCount": 15
}
```

**Rate limited response (429):**
```json
{
  "error": "Please wait 180 seconds before syncing again"
}
```

**Behavior:**
- 5-minute sync cooldown between syncs
- Automatically refreshes tokens if expired
- Upserts up to 100 events per sync
- Handles all-day events and recurring event instances

---

## Auth

Authentication uses Supabase Auth with Google OAuth. The app requests `openid`, `email`, and `profile` scopes.

Deep link callback: `worktracker://auth/callback` (configured in `app.json` scheme).

See [DEEP_LINKING.md](DEEP_LINKING.md) for platform-specific deep link setup.
