# User Guide

## Getting Started

After signing in with Google OAuth, you land on the **Timer** screen. WorkTracker revolves around four main screens accessible via the bottom navigation bar: Timer, History, Analytics, and Settings.

---

## Timer

The timer screen lets you track time in real-time.

### Starting a timer

1. Optionally select a **category** from the category selector at the top.
2. Tap **Start** to begin timing.
3. The elapsed time display updates every second.
4. The timer syncs across your devices automatically — if you start a timer on your phone, it continues on your desktop.

### Stopping a timer

1. Tap **Stop**.
2. Optionally add a **note** describing what you worked on.
3. Tap **Save** to create the time entry.

The timer is stopped atomically — the server creates the time entry and removes the active timer in a single transaction.

### Quick entry

Use **Quick Entry** to log time that already happened without starting a live timer:

1. Tap the **+ Quick Entry** button.
2. Set the start and end times.
3. Select a category (optional) and add a note (optional).
4. Tap **Save**.

---

## Categories

Categories help you organize your time. Each category has three fields:

- **Name** — A short label (e.g. "Deep Work", "Meetings", "Exercise")
- **Color** — A hex color used to visually distinguish the category in charts and lists
- **Type** — One of `work`, `personal`, or `hobby`

The type field controls how categories group in Analytics.

### Managing categories

Go to **Settings > Categories** to:
- Create a new category
- Edit an existing category's name, color, or type
- Delete a category (existing time entries referencing it are kept; the category reference is nulled)

---

## History

The History screen shows all your past time entries in reverse chronological order.

### Filtering

Use the filter bar at the top to narrow entries by:
- **Date range** — e.g. "This week", "This month", or a custom range
- **Category** — Show only entries for a specific category

The list loads more entries as you scroll (infinite scroll).

### Editing an entry

Tap any entry to open the **Edit Entry** modal. You can change:
- Start time
- End time
- Category
- Notes

Tap **Save** to update, or **Delete** to remove the entry permanently.

---

## Analytics

The Analytics screen visualizes how you spend your time.

### Charts

- **Time by category (bar chart)** — Total hours per category over the selected period
- **Daily breakdown** — Hours tracked per day
- **Category distribution (pie chart)** — Proportional split of time across categories

Use the time period selector (week / month / custom) to change the range.

### Understanding the data

- Duration is always shown in **hours and minutes** (e.g. 2h 30m)
- Categories are color-coded consistently across all charts
- Entries without a category appear under "Uncategorized"

---

## Goals

Set monthly time targets and track your progress.

### Creating a goal

1. Go to the **Goals** screen.
2. Tap **+ New Goal**.
3. Set the target hours for the month.
4. Optionally associate the goal with a specific category. Leave blank for an overall goal.

### Progress tracking

Goals display a progress bar showing hours completed vs. target. The color changes as you approach and exceed the target.

---

## Settings

### Profile

View your account email and display name. Sign out from here.

### Categories

Manage your categories (see [Categories](#categories) above).

### Preferences

- **Week starts on** — Set whether your week starts on Sunday or Monday (affects Analytics weekly view)
- **Timezone** — Set your local timezone for accurate daily breakdowns

---

## Offline support

WorkTracker queues mutations locally when your device is offline. When connectivity is restored, changes sync automatically to Supabase. You can still:
- Start and stop timers
- Create time entries
- Edit and delete entries

Changes made offline are reconciled in the order they were made.

---

## Sync across devices

The active timer syncs in real-time. If you start a timer on one device, it appears immediately on another device logged into the same account. Stopping the timer on any device stops it everywhere.
