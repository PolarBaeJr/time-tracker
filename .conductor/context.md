# Feature: Production-Ready Cross-Platform Work Tracking App

## User Requirements

Build a real-time time-tracking application from a single TypeScript/React codebase that runs natively on:
- **macOS** as an Electron desktop application
- **Android** as a native app via Expo EAS
- **iPadOS** as a native app via Expo EAS
- **iPhone** as a native app via Expo EAS

### Core Features
- Start/pause/stop timer
- Assign each time entry to a user-defined category (no pre-seeded defaults — user creates all categories)
- Manual entry edit/delete
- Monthly goals: both overall total AND per-category goals
- Analytics dashboard with:
  - Daily totals (last 30 days)
  - Weekly totals (last 12 weeks)
  - Monthly totals (last 12 months)
  - Hour-of-day and day-of-week prominence (heatmap or histogram)

### Timer Behavior
Server-side timer: `started_at` timestamp stored in Supabase. Elapsed time is computed from wall time (`now - started_at`). Timer survives app restarts and syncs across devices in real-time.

### Auth & Security
- Google OAuth 2.0 + PKCE via Supabase Auth
- Sessions persisted using Supabase SDK defaults (localStorage on web/Electron, SecureStore on native)
- Row Level Security on all user data tables — user_id always derived from the auth token, never trusted from client
- Validate all inputs with Zod

### Offline Support
Basic: local timer state keeps running, entries queue and sync on reconnect. Active timer state is preserved. No full offline SQLite — just graceful degradation.

### UI/UX
- Dark mode by default
- Clean mobile-first UI, responsive on tablet/desktop
- Dashboard: KPI cards, goal progress bars, Victory Native charts
- History screen: date range picker, category filter, notes search, duration filter
- Settings screen: timezone selector, week start day (Monday/Sunday/custom), goal defaults

### Charts
Victory Native (works on React Native and Web from same components)

### Categories
Fully user-defined — no pre-seeded categories. Users create their own from scratch with name, color, and type.

## Tech Stack

- **Frontend**: Expo (React Native + React Native Web), TypeScript
- **Desktop wrapper**: Electron (wraps the React Native Web build)
- **Backend**: Supabase (Postgres, Realtime, Auth with Google provider, RLS)
- **State/query**: TanStack Query + Zustand
- **Charts**: Victory Native
- **Validation**: Zod
- **Testing**: unit (business logic) + integration (Supabase/RLS) + component (React Testing Library)

## Data Model

```sql
-- users (managed by Supabase Auth, extended)
users (id uuid PK, email text, name text, timezone text, week_start_day int default 1)

-- categories (user-defined)
categories (id uuid PK, user_id uuid FK, name text, color text, created_at timestamptz)

-- time entries
time_entries (
  id uuid PK, user_id uuid FK, category_id uuid FK,
  start_at timestamptz, end_at timestamptz, duration_seconds int,
  notes text, created_at timestamptz, updated_at timestamptz
)

-- active timer (one per user)
active_timers (id uuid PK, user_id uuid UNIQUE FK, category_id uuid FK, started_at timestamptz, running bool)

-- monthly goals
monthly_goals (id uuid PK, user_id uuid FK, month date, category_id uuid nullable FK, target_hours numeric)
```

All tables enforce RLS: users can only read/write their own rows.

## Deployment

### Web/Electron
- Self-hosted on **Raspberry Pi 4/5 (arm64/aarch64)**
- Full Docker containerization from scratch
- Step-by-step instructions: Dockerfile, docker-compose.yml, nginx reverse proxy, SSL (Let's Encrypt or self-signed), systemd service for auto-start
- Multi-arch build targeting `linux/arm64`

### Android
- Expo EAS build + publish steps

### iOS/iPadOS
- Expo EAS build + TestFlight or direct install steps

## Q&A

Q1: What is your primary deployment priority?
A1: All platforms simultaneously — macOS desktop app (Electron), Android, iPadOS, iPhone

Q2: Should macOS be a PWA or native app?
A2: Native application — Electron wrapper around the React Native Web build, NOT a browser PWA

Q3: How should the timer behave when the app is closed?
A3: Server-side timer — start_at stored in Supabase, elapsed computed from wall time. Works across devices and restarts.

Q4: Do you have existing Supabase or Google OAuth credentials?
A4: Everything from scratch — generate all setup instructions and migration files from zero

Q5: Which chart library?
A5: Victory Native — works on both React Native and Web from same components

Q6: How should categories be managed?
A6: User-defined, no defaults — users create all their own categories

Q7: What level of offline support?
A7: Basic — timer keeps running locally, sync on reconnect

Q8: What testing scope?
A8: Unit tests for business logic + integration tests for Supabase queries + component tests (React Testing Library)

Q9: How should monthly goals work?
A9: Overall + per-category goals (both)

Q10: What UI theme?
A10: Dark mode default

Q11: History screen filters?
A11: Date range picker, category filter, notes search, duration filter — all four

Q12: Where to deploy web app?
A12: Self-hosted on Raspberry Pi 4/5 (arm64) using Docker — full step-by-step container setup

Q13: Raspberry Pi model?
A13: Raspberry Pi 4 or 5 (arm64/aarch64)

Q14: Auth session persistence?
A14: Supabase SDK defaults (localStorage on web/Electron, SecureStore on native)

Q15: Week start day / timezone?
A15: Fully configurable in Settings screen

## Codebase Notes

- Fresh empty repository — no existing code, dependencies, or conventions
- Git initialized, single `main` branch
- macOS system (Darwin), zsh shell
- `conduct` CLI available at `/opt/homebrew/bin/conduct`
- Build everything from scratch with no backwards-compatibility constraints

## Configuration

Concurrency: 2
Max Cycles: 5
Usage Threshold: 80%
Skip Codex: no
Dry Run: no

## Escalation Resolution (Cycle 1)

**Category type field**: KEEP the `type` field on categories. It is user-selectable when creating/editing a category (e.g. "work", "hobby", "class", or free-text). Show it in the category creation/edit UI alongside name and color.

**Mutation validation**: Use separate Create/Update Zod schemas that EXCLUDE server-managed fields (`id`, `user_id`, `created_at`, `updated_at`). Never accept these from the client. The full entity schemas are only for typing query responses, not for validating mutations.
