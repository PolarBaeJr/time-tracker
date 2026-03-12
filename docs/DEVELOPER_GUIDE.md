# Developer Guide

## Architecture Overview

WorkTracker is a monorepo-style Expo app that compiles to iOS, Android, web, and macOS (via Electron). The backend is Supabase (PostgreSQL + Auth + Realtime).

```
worktracker/
├── src/
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React contexts (auth)
│   ├── hooks/            # TanStack Query hooks for server data
│   ├── lib/              # Supabase client, storage
│   ├── navigation/       # React Navigation stack/tabs
│   ├── schemas/          # Zod schemas + TypeScript types
│   ├── screens/          # Top-level screen components
│   ├── services/         # Business logic (timerService, etc.)
│   ├── stores/           # Zustand stores (timer state)
│   ├── theme/            # Design tokens (colors, spacing, typography)
│   ├── types/            # Shared TypeScript types (generated from schemas)
│   └── utils/            # Pure utility functions (analytics calculations)
├── electron/             # Electron main process + builder config
├── supabase/
│   ├── migrations/       # SQL migration files (apply with supabase db push)
│   ├── tests/            # RLS SQL integration tests
│   └── seed.sql          # Local dev seed data
├── scripts/              # deploy.sh, test-integration.sh, generate-assets.js
├── docs/                 # Documentation
└── .github/workflows/    # CI/CD pipelines
```

## Local Setup

### 1. Install tools

- Node.js 20+
- Supabase CLI: `brew install supabase/tap/supabase`
- Docker (required by Supabase CLI)
- Expo Go (optional, for testing on physical device)

### 2. Install dependencies

```bash
cd worktracker
npm install
```

### 3. Start local Supabase

```bash
supabase start
```

This applies all migrations automatically and prints the local URL + keys.

### 4. Configure `.env`

```bash
cp .env.example .env
# Paste the local URL and anon key from `supabase start` output
```

### 5. Start the dev server

```bash
npm start       # Expo (mobile + web)
npm run electron:dev  # Electron
```

## Coding Standards

### Create/Update schema pattern

All data mutations use separate `Create*` and `Update*` Zod schemas:

- `Create*` schemas include all required fields **except** `id`, `user_id`, `created_at`, `updated_at` — the database sets these.
- `Update*` schemas make all fields optional (partial) and never include `user_id`.
- `user_id` is **never sent from the client**. It is set server-side by `auth.uid()` via a PostgreSQL default or trigger.

Example:
```typescript
// schemas/category.ts
export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  type: z.enum(['work', 'personal', 'hobby']),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();
```

### Data fetching

All server data is fetched via TanStack Query hooks in `src/hooks/`. Never call Supabase directly from a component.

```typescript
// Good
const { data: categories } = useCategories();

// Bad
const { data } = await supabase.from('categories').select('*');
```

### Timer store

The active timer state lives in Zustand (`src/stores/timerStore.ts`). The store holds the local timer state (elapsed seconds, running flag) and is bootstrapped from Supabase on app start. Mutations go through `src/services/timerService.ts`.

### Realtime

The `useRealtimeTimer` hook subscribes to Supabase Realtime changes on the `active_timers` table. It updates the Zustand store when another device changes the timer.

## Testing

### Unit tests

```bash
npm test
npm run test:coverage
```

Tests live in `src/__tests__/`. Use the mocks in `src/__tests__/mocks/` for Supabase and React Native.

The jest config maps `@/` aliases to `src/` so imports work the same as in production code.

### Integration tests

```bash
# RLS SQL tests (requires supabase start)
./scripts/test-integration.sh

# TypeScript integration tests
INTEGRATION_TESTS=true npm test -- --testPathPattern=integration
```

Integration tests in `src/__tests__/integration/` are skipped unless `INTEGRATION_TESTS=true`.

### Writing tests

- Component tests test pure logic functions extracted from components (React Native rendering is mocked)
- Service tests mock `@/lib/supabase` and verify correct Supabase API calls
- Schema tests verify validation accepts/rejects expected inputs

## PR Process

1. Branch off `main` using `feat/`, `fix/`, or `chore/` prefixes
2. Run `npm run lint && npm run typecheck && npm test` before pushing
3. Husky pre-commit hooks run lint-staged automatically
4. PRs require passing CI (lint + typecheck + unit tests)
5. Integration tests run separately — they require Docker and are only run on `main` branch pushes

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev only | Service role key for seed scripts (never bundled) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | For Email/Calendar | Google OAuth client ID for Gmail and Google Calendar |
| `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` | For Email/Calendar | Microsoft OAuth client ID for Outlook Email and Calendar |
| `INTEGRATION_TESTS` | CI only | Set to `true` to run integration tests |

All `EXPO_PUBLIC_*` variables are embedded in the app bundle at build time. Never put secrets in `EXPO_PUBLIC_*` variables.

## Email and Calendar OAuth Setup

### Google (Gmail & Google Calendar)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Navigate to **APIs & Services > Credentials**
4. Create an **OAuth 2.0 Client ID** with application type **Web application**
5. Add authorized JavaScript origins:
   - `http://localhost:8081` (development)
   - `http://localhost:19006` (Expo web)
   - Your production domain
6. Add authorized redirect URIs:
   - `http://localhost:8081/email/gmail/callback`
   - `http://localhost:8081/calendar/google/callback`
   - Production equivalents
7. Enable the following APIs in **APIs & Services > Library**:
   - Gmail API
   - Google Calendar API
8. Copy the client ID to `.env` as `EXPO_PUBLIC_GOOGLE_CLIENT_ID`

**Required OAuth Scopes:**
- Gmail: `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/userinfo.email`
- Calendar: `https://www.googleapis.com/auth/calendar.readonly`, `https://www.googleapis.com/auth/userinfo.email`

### Microsoft (Outlook Email & Calendar)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Set the name and select **Accounts in any organizational directory and personal Microsoft accounts**
5. Add redirect URIs (Web platform):
   - `http://localhost:8081/email/outlook/callback`
   - `http://localhost:8081/calendar/outlook/callback`
   - Production equivalents
6. Go to **API permissions** and add:
   - Microsoft Graph > Delegated permissions:
     - `Mail.Read`
     - `Calendars.Read`
     - `User.Read`
     - `offline_access`
7. Copy the **Application (client) ID** to `.env` as `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`

**Note:** Microsoft uses the common tenant endpoint (`/common/oauth2/v2.0`) for multi-tenant apps, which allows both personal Microsoft accounts and work/school accounts.

### Supabase Edge Function Secrets

The email-sync and calendar-sync Edge Functions need server-side access to refresh OAuth tokens. Set these secrets in Supabase:

```bash
# Generate an encryption key for token storage
openssl rand -base64 32

# Set the secrets
supabase secrets set ENCRYPTION_KEY="your-generated-key"
supabase secrets set GOOGLE_CLIENT_ID="your-google-client-id"
supabase secrets set MICROSOFT_CLIENT_ID="your-microsoft-client-id"
```
