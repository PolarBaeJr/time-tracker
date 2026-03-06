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

## Auth

Authentication uses Supabase Auth with Google OAuth. The app requests `openid`, `email`, and `profile` scopes.

Deep link callback: `worktracker://auth/callback` (configured in `app.json` scheme).

See [DEEP_LINKING.md](DEEP_LINKING.md) for platform-specific deep link setup.
