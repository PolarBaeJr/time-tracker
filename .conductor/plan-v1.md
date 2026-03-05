I now have a complete understanding of the previous plan and the review feedback. Let me create an improved plan that addresses the identified issues:

1. **User Documentation task** - needs proper dependencies on previous tasks
2. **Component Tests task** - needs dependency on "Build Category Management Screen"
3. Need to ensure all task dependencies are accurate and consistent

Let me create the comprehensive plan:

# Production-Ready Cross-Platform Work Tracking App Implementation Plan

## Executive Summary

This plan outlines the implementation of a production-ready, cross-platform work tracking application using a single TypeScript/React codebase. The app will run on macOS (Electron), Android, iPadOS, and iPhone, with a Supabase backend providing real-time sync, Google OAuth, and Row Level Security.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Applications                          │
├──────────────┬──────────────┬────────────────┬─────────────────────┤
│   Electron   │   Android    │    iPadOS      │      iPhone         │
│   (macOS)    │   (Expo)     │    (Expo)      │      (Expo)         │
└──────┬───────┴──────┬───────┴────────┬───────┴──────────┬──────────┘
       │              │                │                  │
       └──────────────┴────────────────┴──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Shared React    │
                    │   Native Code     │
                    │   (TypeScript)    │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
   ┌─────▼─────┐       ┌──────▼──────┐     ┌──────▼──────┐
   │ TanStack  │       │   Zustand   │     │   Victory   │
   │  Query    │       │   (State)   │     │   Native    │
   └─────┬─────┘       └─────────────┘     └─────────────┘
         │
   ┌─────▼─────────────────────────────────────────┐
   │              Supabase Client SDK              │
   ├───────────────┬───────────────┬───────────────┤
   │     Auth      │    Realtime   │   Postgres    │
   │  (Google)     │    (Timer)    │   (Data)      │
   └───────┬───────┴───────┬───────┴───────┬───────┘
           │               │               │
   ┌───────▼───────────────▼───────────────▼───────┐
   │              Supabase Backend                 │
   │            (Supabase Cloud)                   │
   ├───────────────────────────────────────────────┤
   │  PostgreSQL + RLS │ Realtime │ GoTrue Auth    │
   └───────────────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Raspberry Pi 5    │
              │   (Docker/arm64)    │
              └─────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Authentication Flow                        │
├─────────────────────────────────────────────────────────────────┤
│  User → Google OAuth → Supabase Auth → JWT Token → RLS Policy  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Timer Flow                               │
├─────────────────────────────────────────────────────────────────┤
│  Start Timer:                                                   │
│  Client → Validate(Zod) → Supabase → RLS Check → active_timers │
│                                                                 │
│  Real-time Sync:                                                │
│  active_timers (DB) → Realtime Channel → All User Devices      │
│                                                                 │
│  Stop Timer:                                                    │
│  Client → active_timers.delete → time_entries.insert           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Offline Queue Flow                         │
├─────────────────────────────────────────────────────────────────┤
│  Offline:  Action → Zustand Store → AsyncStorage/localStorage  │
│  Online:   Queue → Process → Supabase → Clear Queue            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Threat Model

```threat_model
{
  "data_flows": [
    {
      "name": "Authentication Flow",
      "source": "User (Browser/Native App)",
      "destination": "Supabase Auth (GoTrue)",
      "data": "Google OAuth tokens, user credentials, JWT session tokens",
      "protocol": "HTTPS with PKCE"
    },
    {
      "name": "Timer Operations",
      "source": "Client Application",
      "destination": "Supabase Postgres (active_timers table)",
      "data": "Timer start/stop timestamps, category IDs",
      "protocol": "HTTPS REST API + Realtime WebSocket"
    },
    {
      "name": "Time Entry CRUD",
      "source": "Client Application",
      "destination": "Supabase Postgres (time_entries table)",
      "data": "Duration, notes, category assignments, timestamps",
      "protocol": "HTTPS REST API"
    },
    {
      "name": "Real-time Sync",
      "source": "Supabase Realtime",
      "destination": "All User's Connected Devices",
      "data": "Active timer state changes",
      "protocol": "WebSocket (wss://)"
    },
    {
      "name": "Offline Queue Sync",
      "source": "Local Storage (AsyncStorage/localStorage)",
      "destination": "Supabase Postgres",
      "data": "Queued time entries and timer actions",
      "protocol": "HTTPS REST API on reconnect"
    },
    {
      "name": "Analytics Queries",
      "source": "Client Application",
      "destination": "Supabase Postgres",
      "data": "Aggregated time data (daily/weekly/monthly totals)",
      "protocol": "HTTPS REST API"
    }
  ],
  "trust_boundaries": [
    {
      "name": "Client-Server Boundary",
      "description": "All client inputs are untrusted. Server validates via RLS and Zod schemas.",
      "components_inside": ["Supabase Auth", "Supabase Postgres", "RLS Policies"],
      "components_outside": ["Expo App", "Electron App", "Local Storage"]
    },
    {
      "name": "Authentication Boundary",
      "description": "Only authenticated users with valid JWT can access data APIs.",
      "enforcement": "Supabase Auth + RLS policies checking auth.uid()"
    },
    {
      "name": "User Data Isolation Boundary",
      "description": "Users can only access their own data via RLS user_id = auth.uid() checks.",
      "enforcement": "PostgreSQL Row Level Security on all tables"
    },
    {
      "name": "External OAuth Boundary",
      "description": "Google OAuth provider is external; tokens validated by Supabase Auth.",
      "enforcement": "PKCE flow, state parameter, token verification"
    }
  ],
  "attack_surfaces": [
    {
      "name": "Google OAuth Login Endpoint",
      "type": "Authentication",
      "threats": [
        {
          "stride": "Spoofing",
          "description": "Attacker impersonates legitimate user via stolen OAuth tokens",
          "likelihood": "Medium",
          "impact": "High"
        },
        {
          "stride": "Repudiation",
          "description": "User denies performing actions without audit trail",
          "likelihood": "Low",
          "impact": "Medium"
        }
      ],
      "mitigations": [
        "Use PKCE flow (code_challenge/code_verifier) to prevent authorization code interception",
        "Validate state parameter to prevent CSRF attacks",
        "Short-lived access tokens with refresh token rotation",
        "Audit logging of authentication events in Supabase"
      ]
    },
    {
      "name": "Timer Start/Stop API",
      "type": "Data Mutation",
      "threats": [
        {
          "stride": "Tampering",
          "description": "Attacker modifies started_at timestamp to inflate tracked time",
          "likelihood": "Medium",
          "impact": "Medium"
        },
        {
          "stride": "Denial of Service",
          "description": "Rapid timer start/stop calls exhaust database connections",
          "likelihood": "Medium",
          "impact": "Medium"
        },
        {
          "stride": "Elevation of Privilege",
          "description": "Attacker attempts to start timer for another user",
          "likelihood": "Low",
          "impact": "High"
        }
      ],
      "mitigations": [
        "RLS policy: user_id must equal auth.uid() on all operations",
        "Server-side timestamp: started_at defaults to now() in database, not client-provided",
        "Rate limiting via Supabase edge functions or API gateway",
        "Zod validation: category_id must be valid UUID",
        "Database constraint: only one active timer per user (UNIQUE on user_id)"
      ]
    },
    {
      "name": "Time Entry CRUD Operations",
      "type": "Data Mutation",
      "threats": [
        {
          "stride": "Tampering",
          "description": "Attacker modifies duration_seconds or timestamps of existing entries",
          "likelihood": "Medium",
          "impact": "Medium"
        },
        {
          "stride": "Information Disclosure",
          "description": "Attacker reads other users' time entries",
          "likelihood": "Low",
          "impact": "High"
        },
        {
          "stride": "Spoofing",
          "description": "Attacker creates entries for another user",
          "likelihood": "Low",
          "impact": "High"
        }
      ],
      "mitigations": [
        "RLS SELECT policy: user_id = auth.uid()",
        "RLS INSERT policy: user_id = auth.uid() AND user_id cannot be set by client (use default)",
        "RLS UPDATE policy: user_id = auth.uid() AND user_id column immutable",
        "RLS DELETE policy: user_id = auth.uid()",
        "Zod validation: duration_seconds >= 0, timestamps valid ISO8601",
        "Audit columns: created_at, updated_at auto-set by database"
      ]
    },
    {
      "name": "Category Management",
      "type": "Data Mutation",
      "threats": [
        {
          "stride": "Tampering",
          "description": "Attacker modifies another user's categories",
          "likelihood": "Low",
          "impact": "Medium"
        },
        {
          "stride": "Denial of Service",
          "description": "Attacker creates excessive categories to exhaust storage",
          "likelihood": "Low",
          "impact": "Low"
        }
      ],
      "mitigations": [
        "RLS policies enforcing user_id = auth.uid() on all operations",
        "Limit categories per user (e.g., max 100) via database CHECK or trigger",
        "Zod validation: name length 1-100 chars, color valid hex format, type length 1-50 chars"
      ]
    },
    {
      "name": "Monthly Goals API",
      "type": "Data Mutation",
      "threats": [
        {
          "stride": "Tampering",
          "description": "Attacker modifies goals to hide missed targets",
          "likelihood": "Low",
          "impact": "Low"
        }
      ],
      "mitigations": [
        "RLS policies enforcing user_id = auth.uid()",
        "Zod validation: target_hours > 0, month valid date format",
        "Unique constraint on (user_id, month, category_id) to prevent duplicates"
      ]
    },
    {
      "name": "Real-time WebSocket Channel",
      "type": "Data Subscription",
      "threats": [
        {
          "stride": "Information Disclosure",
          "description": "Attacker subscribes to another user's timer channel",
          "likelihood": "Low",
          "impact": "High"
        },
        {
          "stride": "Denial of Service",
          "description": "Attacker opens many WebSocket connections",
          "likelihood": "Medium",
          "impact": "Medium"
        }
      ],
      "mitigations": [
        "Supabase Realtime RLS: channel subscriptions filtered by user_id = auth.uid()",
        "Connection limits per user in Supabase project settings",
        "JWT verification on WebSocket connection establishment"
      ]
    },
    {
      "name": "Offline Queue Local Storage",
      "type": "Local Data Storage",
      "threats": [
        {
          "stride": "Tampering",
          "description": "Attacker with device access modifies queued entries",
          "likelihood": "Medium",
          "impact": "Low"
        },
        {
          "stride": "Information Disclosure",
          "description": "Sensitive data exposed in local storage",
          "likelihood": "Medium",
          "impact": "Medium"
        }
      ],
      "mitigations": [
        "Use SecureStore on native platforms for sensitive data",
        "Re-validate all queued entries server-side before committing",
        "Queue entries are re-authenticated on sync (must have valid session)",
        "Clear queue on logout"
      ]
    },
    {
      "name": "Electron Desktop App",
      "type": "Desktop Application",
      "threats": [
        {
          "stride": "Elevation of Privilege",
          "description": "XSS in web content leads to Node.js access",
          "likelihood": "Medium",
          "impact": "Critical"
        },
        {
          "stride": "Information Disclosure",
          "description": "Exposed IPC channels leak sensitive data",
          "likelihood": "Medium",
          "impact": "High"
        }
      ],
      "mitigations": [
        "Enable contextIsolation: true in Electron",
        "Set nodeIntegration: false in renderer",
        "Use preload scripts with contextBridge for safe IPC",
        "Sanitize all data passed through IPC channels",
        "Enable webSecurity: true",
        "Content Security Policy headers"
      ]
    },
    {
      "name": "Docker Deployment on Raspberry Pi",
      "type": "Infrastructure",
      "threats": [
        {
          "stride": "Tampering",
          "description": "Attacker modifies container images or volumes",
          "likelihood": "Low",
          "impact": "Critical"
        },
        {
          "stride": "Denial of Service",
          "description": "Resource exhaustion on limited Pi hardware",
          "likelihood": "Medium",
          "impact": "Medium"
        },
        {
          "stride": "Information Disclosure",
          "description": "Exposed ports or misconfigured nginx leaks data",
          "likelihood": "Medium",
          "impact": "High"
        }
      ],
      "mitigations": [
        "Use official base images, pin versions",
        "Run containers as non-root user",
        "Limit container resources (memory, CPU)",
        "nginx: disable server tokens, configure proper headers",
        "SSL/TLS only (redirect HTTP to HTTPS)",
        "Firewall: only expose ports 80, 443",
        "Regular security updates via apt"
      ]
    },
    {
      "name": "User Input Fields (Notes, Category Names, Category Types)",
      "type": "User Input",
      "threats": [
        {
          "stride": "Tampering",
          "description": "XSS injection via notes, category names, or type fields",
          "likelihood": "Medium",
          "impact": "Medium"
        },
        {
          "stride": "Denial of Service",
          "description": "Extremely long strings cause performance issues",
          "likelihood": "Low",
          "impact": "Low"
        }
      ],
      "mitigations": [
        "Zod validation with maxLength constraints",
        "React Native auto-escapes text content (no innerHTML)",
        "Database TEXT columns with CHECK constraints on length",
        "Sanitize before display (defense in depth)"
      ]
    }
  ],
  "required_mitigations_summary": [
    {
      "category": "Authentication",
      "controls": [
        "Google OAuth with PKCE flow",
        "State parameter for CSRF protection",
        "JWT validation on all API calls",
        "Session token rotation"
      ]
    },
    {
      "category": "Authorization",
      "controls": [
        "RLS policies on ALL tables",
        "user_id derived from auth.uid(), never from client",
        "Immutable user_id column in RLS UPDATE policies",
        "Default values for server-controlled fields (timestamps)"
      ]
    },
    {
      "category": "Input Validation",
      "controls": [
        "Zod schemas for all client inputs",
        "Separate Create/Update schemas excluding server-managed fields (id, user_id, timestamps)",
        "Server-side re-validation (RLS + database constraints)",
        "Length limits on text fields",
        "UUID format validation for IDs"
      ]
    },
    {
      "category": "Transport Security",
      "controls": [
        "HTTPS only (TLS 1.2+)",
        "WSS for WebSocket connections",
        "Certificate pinning consideration for native apps"
      ]
    },
    {
      "category": "Electron Security",
      "controls": [
        "contextIsolation: true",
        "nodeIntegration: false",
        "Preload scripts with contextBridge",
        "Content Security Policy"
      ]
    },
    {
      "category": "Infrastructure",
      "controls": [
        "Docker containers run as non-root",
        "Resource limits on containers",
        "nginx hardening (no server tokens, security headers)",
        "SSL certificates (Let's Encrypt)",
        "Firewall rules (UFW)"
      ]
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Foundation (Tasks 1-6)
Establish project structure, tooling, and shared types/schemas that all other work depends on.

### Phase 2: Backend (Tasks 7-12)
Database migrations, RLS policies, and Supabase configuration.

### Phase 3: Core Features (Tasks 13-22)
Authentication, timer functionality, categories, time entries, and state management.

### Phase 4: UI Components (Tasks 23-32)
Screens, navigation, charts, and responsive layouts.

### Phase 5: Platform Integration (Tasks 33-38)
Electron wrapper, Expo configuration, and platform-specific code.

### Phase 6: Infrastructure (Tasks 39-43)
Docker, nginx, SSL, and deployment automation.

### Phase 7: Testing & Polish (Tasks 44-48)
Unit tests, integration tests, E2E tests, and documentation.

---

## Detailed Task Breakdown

### Phase 1: Foundation

#### Task 1: Initialize Expo Project with TypeScript
**Files:** `package.json`, `tsconfig.json`, `app.json`, `babel.config.js`, `.gitignore`
**Description:** Create new Expo project with TypeScript template, configure strict mode, set up path aliases.
**Rationale:** Expo provides the cross-platform foundation; TypeScript ensures type safety.
**Dependencies:** None (anchor task)
**Testing:** `npx tsc --noEmit` passes, Expo dev server starts.

#### Task 2: Configure ESLint, Prettier, and Husky
**Files:** `.eslintrc.js`, `.prettierrc`, `.husky/`, `lint-staged.config.js`
**Description:** Set up linting with React Native and TypeScript rules, Prettier for formatting, Husky for pre-commit hooks.
**Rationale:** Enforce code quality from day one.
**Dependencies:** Task 1
**Testing:** `npm run lint` passes, pre-commit hook runs.

#### Task 3: Define Zod Schemas and TypeScript Types
**Files:** `src/types/index.ts`, `src/schemas/user.ts`, `src/schemas/category.ts`, `src/schemas/timeEntry.ts`, `src/schemas/timer.ts`, `src/schemas/goal.ts`
**Description:** Create Zod schemas matching the database model. Define full entity schemas for response typing AND separate Create/Update schemas for mutations that EXCLUDE server-managed fields (id, user_id, created_at, updated_at). Categories include `type` field.
**Rationale:** Single source of truth for validation and types with proper separation between query responses and mutation payloads.
**Dependencies:** Task 1 (anchor task)
**Testing:** Unit tests for schema validation edge cases.

#### Task 4: Create Supabase Client Configuration
**Files:** `src/lib/supabase.ts`, `src/lib/supabase.native.ts`, `src/lib/supabase.web.ts`
**Description:** Initialize Supabase client with platform-specific storage adapters (SecureStore for native, localStorage for web).
**Rationale:** Platform-appropriate secure storage for auth tokens.
**Dependencies:** Task 1
**Testing:** Client initializes without errors on both platforms.

#### Task 5: Set Up Theme and Design Tokens
**Files:** `src/theme/colors.ts`, `src/theme/spacing.ts`, `src/theme/typography.ts`, `src/theme/index.ts`
**Description:** Define dark mode color palette, spacing scale, typography system.
**Rationale:** Consistent design language across all screens.
**Dependencies:** Task 1 (anchor task)
**Testing:** Theme exports are valid, types correct.

#### Task 6: Create Base UI Components
**Files:** `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Text.tsx`, `src/components/ui/index.ts`
**Description:** Build reusable themed UI primitives with accessibility support.
**Rationale:** Consistent, accessible UI building blocks.
**Dependencies:** Task 5
**Testing:** Component unit tests with React Testing Library.

### Phase 2: Backend

#### Task 7: Create Supabase Database Migrations
**Files:** `supabase/migrations/001_create_users.sql`, `supabase/migrations/002_create_categories.sql`, `supabase/migrations/003_create_time_entries.sql`, `supabase/migrations/004_create_active_timers.sql`, `supabase/migrations/005_create_monthly_goals.sql`
**Description:** SQL migrations for all tables with proper constraints, indexes, and triggers. Categories table includes `type` column with CHECK constraint.
**Rationale:** Version-controlled, reproducible database schema.
**Dependencies:** Task 3 (schema definitions inform table structure) (anchor task)
**Testing:** Migrations apply cleanly, schema matches spec.

#### Task 8: Implement Row Level Security Policies
**Files:** `supabase/migrations/006_rls_policies.sql`
**Description:** RLS policies for all tables ensuring user_id = auth.uid() on all operations.
**Rationale:** Core security control preventing cross-user data access.
**Dependencies:** Task 7
**Testing:** Integration tests verifying RLS blocks unauthorized access.

#### Task 9: Create Database Functions and Triggers
**Files:** `supabase/migrations/007_functions.sql`
**Description:** Functions for: auto-set user_id on insert, update timestamp triggers, timer-to-entry conversion.
**Rationale:** Ensure server-side data integrity, prevent client manipulation.
**Dependencies:** Task 7
**Testing:** Trigger fires correctly, user_id always set from auth context.

#### Task 10: Configure Supabase Auth with Google OAuth
**Files:** `supabase/config.toml`, `docs/SUPABASE_SETUP.md`
**Description:** Document and script Supabase project setup, Google OAuth configuration, redirect URLs.
**Rationale:** Reproducible auth setup for development and production.
**Dependencies:** Task 4
**Testing:** OAuth flow completes successfully in test environment.

#### Task 11: Create Supabase Realtime Configuration
**Files:** `supabase/migrations/008_realtime_config.sql`
**Description:** Enable realtime on active_timers table, configure channel access policies.
**Rationale:** Real-time timer sync across devices.
**Dependencies:** Task 7, Task 8
**Testing:** Realtime events received only by authorized users.

#### Task 12: Create Database Seed Script
**Files:** `supabase/seed.sql`, `scripts/seed-dev.ts`
**Description:** Development seed data script (respecting no pre-seeded categories rule - only test users).
**Rationale:** Reproducible development environment.
**Dependencies:** Task 7
**Testing:** Seed runs without errors, creates test accounts.

### Phase 3: Core Features

#### Task 13: Implement Authentication Context and Hooks
**Files:** `src/contexts/AuthContext.tsx`, `src/hooks/useAuth.ts`, `src/hooks/useSession.ts`
**Description:** React context for auth state, hooks for login/logout/session management.
**Rationale:** Centralized auth state accessible throughout app.
**Dependencies:** Task 4, Task 10
**Testing:** Auth state updates correctly on login/logout.

#### Task 14: Create Login Screen with Google OAuth
**Files:** `src/screens/LoginScreen.tsx`, `src/components/auth/GoogleSignInButton.tsx`
**Description:** Login screen with Google OAuth button, PKCE flow, loading states, error handling.
**Rationale:** Secure, user-friendly authentication entry point.
**Dependencies:** Task 6, Task 13
**Testing:** Component renders, OAuth flow initiates correctly.

#### Task 15: Implement Timer Zustand Store
**Files:** `src/stores/timerStore.ts`
**Description:** Zustand store for local timer state, elapsed time calculation, offline queue.
**Rationale:** Fast local state with persistence for offline support.
**Dependencies:** Task 3
**Testing:** Unit tests for state transitions and elapsed calculation.

#### Task 16: Create Timer Service with Supabase Integration
**Files:** `src/services/timerService.ts`
**Description:** Service layer for timer operations: start, pause (creates entry), stop (creates entry), sync.
**Rationale:** Encapsulate timer business logic and API calls.
**Dependencies:** Task 4, Task 9, Task 15
**Testing:** Unit tests with mocked Supabase client.

#### Task 17: Implement Real-time Timer Subscription
**Files:** `src/hooks/useRealtimeTimer.ts`
**Description:** Hook subscribing to active_timers realtime channel, updating local store on changes.
**Rationale:** Instant timer sync across all user devices.
**Dependencies:** Task 11, Task 15
**Testing:** Integration test: change on one client appears on another.

#### Task 18: Create Categories TanStack Query Hooks
**Files:** `src/hooks/useCategories.ts`, `src/hooks/useCategoryMutations.ts`
**Description:** TanStack Query hooks for CRUD operations on categories with optimistic updates. Mutations use CreateCategorySchema/UpdateCategorySchema (NOT full CategorySchema).
**Rationale:** Efficient data fetching with caching and optimistic UI.
**Dependencies:** Task 3, Task 4
**Testing:** Hook tests with mocked queries.

#### Task 19: Create Time Entries TanStack Query Hooks
**Files:** `src/hooks/useTimeEntries.ts`, `src/hooks/useTimeEntryMutations.ts`
**Description:** Hooks for paginated time entry queries, filters, CRUD mutations. Mutations use CreateTimeEntrySchema/UpdateTimeEntrySchema.
**Rationale:** Efficient entry management with filtering and pagination.
**Dependencies:** Task 3, Task 4
**Testing:** Filter and pagination logic tested.

#### Task 20: Implement Goals TanStack Query Hooks
**Files:** `src/hooks/useGoals.ts`, `src/hooks/useGoalMutations.ts`
**Description:** Hooks for monthly goals (overall and per-category), progress calculation. Mutations use CreateGoalSchema/UpdateGoalSchema.
**Rationale:** Goal tracking with computed progress percentages.
**Dependencies:** Task 3, Task 4, Task 19
**Testing:** Goal progress calculation accuracy.

#### Task 21: Create Analytics Query Hooks
**Files:** `src/hooks/useAnalytics.ts`
**Description:** Hooks for aggregated analytics: daily/weekly/monthly totals, hour/day heatmap data.
**Rationale:** Efficient analytics queries with appropriate caching.
**Dependencies:** Task 4, Task 19
**Testing:** Aggregation logic matches expected output.

#### Task 22: Implement Offline Queue and Sync
**Files:** `src/services/offlineQueue.ts`, `src/hooks/useOfflineSync.ts`
**Description:** Queue actions when offline, sync when connectivity restored, conflict resolution.
**Rationale:** Graceful degradation without full offline database.
**Dependencies:** Task 15, Task 16, Task 19
**Testing:** Queue persists, syncs correctly on reconnect.

### Phase 4: UI Components

#### Task 23: Create Navigation Structure
**Files:** `src/navigation/RootNavigator.tsx`, `src/navigation/MainTabs.tsx`, `src/navigation/types.ts`
**Description:** React Navigation with bottom tabs (Timer, History, Analytics, Settings), auth-gated routes.
**Rationale:** Standard mobile navigation pattern.
**Dependencies:** Task 13
**Testing:** Navigation renders correctly, auth gates work.

#### Task 24: Build Timer Screen
**Files:** `src/screens/TimerScreen.tsx`, `src/components/timer/TimerDisplay.tsx`, `src/components/timer/TimerControls.tsx`, `src/components/timer/CategorySelector.tsx`
**Description:** Main timer screen with large display, start/pause/stop controls, category picker.
**Rationale:** Primary user interaction point.
**Dependencies:** Task 6, Task 16, Task 17, Task 18
**Testing:** Component tests for all timer states.

#### Task 25: Build Quick Entry Component
**Files:** `src/components/timer/QuickEntry.tsx`
**Description:** Form for manual time entry creation with validation using CreateTimeEntrySchema.
**Rationale:** Users need to add historical entries.
**Dependencies:** Task 6, Task 19
**Testing:** Form validation, submission flow.

#### Task 26: Build History Screen
**Files:** `src/screens/HistoryScreen.tsx`, `src/components/history/EntryList.tsx`, `src/components/history/EntryCard.tsx`, `src/components/history/HistoryFilters.tsx`
**Description:** Paginated entry list with date range picker, category filter, notes search, duration filter.
**Rationale:** Users need to review and manage past entries.
**Dependencies:** Task 6, Task 19
**Testing:** Filter interactions, pagination behavior.

#### Task 27: Build Entry Edit Modal
**Files:** `src/components/history/EntryEditModal.tsx`
**Description:** Modal for editing/deleting existing time entries using UpdateTimeEntrySchema for validation.
**Rationale:** Users need to correct mistakes.
**Dependencies:** Task 6, Task 19
**Testing:** Edit saves correctly, delete confirms.

#### Task 28: Build Analytics Dashboard Screen
**Files:** `src/screens/AnalyticsScreen.tsx`, `src/components/analytics/KPICards.tsx`, `src/components/analytics/GoalProgress.tsx`
**Description:** Dashboard with KPI cards, goal progress bars, chart containers.
**Rationale:** Visual overview of productivity.
**Dependencies:** Task 6, Task 20, Task 21
**Testing:** Data flows correctly to display components.

#### Task 29: Implement Victory Native Charts
**Files:** `src/components/charts/DailyChart.tsx`, `src/components/charts/WeeklyChart.tsx`, `src/components/charts/MonthlyChart.tsx`, `src/components/charts/HeatmapChart.tsx`
**Description:** Victory Native charts for all analytics visualizations.
**Rationale:** Cross-platform charting from single codebase.
**Dependencies:** Task 21
**Testing:** Charts render with mock data.

#### Task 30: Build Settings Screen
**Files:** `src/screens/SettingsScreen.tsx`, `src/components/settings/TimezoneSelector.tsx`, `src/components/settings/WeekStartSelector.tsx`, `src/components/settings/GoalDefaults.tsx`
**Description:** Settings for timezone, week start day, default goals.
**Rationale:** User customization for accurate time tracking.
**Dependencies:** Task 6, Task 13
**Testing:** Settings persist and apply correctly.

#### Task 31: Build Category Management Screen
**Files:** `src/screens/CategoriesScreen.tsx`, `src/components/categories/CategoryForm.tsx`, `src/components/categories/CategoryList.tsx`
**Description:** CRUD interface for user-defined categories with name, color, AND type fields. Validates with CreateCategorySchema/UpdateCategorySchema.
**Rationale:** Users must create their own categories with full metadata.
**Dependencies:** Task 6, Task 18
**Testing:** CRUD operations work correctly including type field.

#### Task 32: Build Goals Management Screen
**Files:** `src/screens/GoalsScreen.tsx`, `src/components/goals/GoalForm.tsx`, `src/components/goals/GoalList.tsx`
**Description:** Interface for setting monthly overall and per-category goals using CreateGoalSchema/UpdateGoalSchema.
**Rationale:** Users need to define productivity targets.
**Dependencies:** Task 6, Task 20
**Testing:** Goal creation and progress display.

### Phase 5: Platform Integration

#### Task 33: Configure Expo for Multi-Platform Build
**Files:** `app.json`, `eas.json`, `app.config.js`
**Description:** EAS configuration for Android and iOS builds, app icons, splash screens.
**Rationale:** Proper native app configuration.
**Dependencies:** Task 1
**Testing:** EAS build succeeds for both platforms.

#### Task 34: Create Electron Main Process
**Files:** `electron/main.ts`, `electron/preload.ts`
**Description:** Electron main process with security hardening (contextIsolation, nodeIntegration disabled).
**Rationale:** Secure desktop wrapper for web build.
**Dependencies:** Task 1
**Testing:** Electron app launches, security settings verified.

#### Task 35: Configure Electron Build Pipeline
**Files:** `electron/forge.config.ts`, `package.json` (scripts)
**Description:** Electron Forge configuration for macOS builds, code signing setup.
**Rationale:** Distributable desktop application.
**Dependencies:** Task 34
**Testing:** macOS app bundle builds and runs.

#### Task 36: Implement Platform-Specific Storage
**Files:** `src/lib/storage.ts`, `src/lib/storage.native.ts`, `src/lib/storage.web.ts`
**Description:** Abstraction over AsyncStorage (native) and localStorage (web) with SecureStore for sensitive data.
**Rationale:** Secure, platform-appropriate data persistence.
**Dependencies:** Task 4
**Testing:** Storage operations work on all platforms.

#### Task 37: Configure Deep Linking for OAuth
**Files:** `app.json` (scheme), `src/lib/linking.ts`
**Description:** Configure URL scheme for OAuth redirect handling on all platforms using PKCE code exchange.
**Rationale:** OAuth callback must return to app.
**Dependencies:** Task 13, Task 33
**Testing:** OAuth redirect returns to app correctly.

#### Task 38: Add App Icons and Splash Screens
**Files:** `assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png`
**Description:** Create and configure app icons for all platforms, splash screen.
**Rationale:** Professional appearance on app stores.
**Dependencies:** Task 33
**Testing:** Icons display correctly on all platforms.

### Phase 6: Infrastructure

#### Task 39: Create Production Dockerfile
**Files:** `Dockerfile`, `.dockerignore`
**Description:** Multi-stage Dockerfile for arm64, builds web app with nginx server.
**Rationale:** Containerized deployment for Raspberry Pi.
**Dependencies:** Task 1
**Testing:** Docker build succeeds, image runs.

#### Task 40: Create Docker Compose Configuration
**Files:** `docker-compose.yml`, `docker-compose.prod.yml`
**Description:** Compose file for web app, potentially local Supabase for development.
**Rationale:** Easy orchestration of services.
**Dependencies:** Task 39
**Testing:** `docker-compose up` starts services correctly.

#### Task 41: Configure Nginx Reverse Proxy
**Files:** `nginx/nginx.conf`, `nginx/ssl.conf`
**Description:** Nginx configuration with security headers, SSL termination, gzip.
**Rationale:** Production-grade web server configuration.
**Dependencies:** Task 39
**Testing:** Nginx serves app with correct headers.

#### Task 42: Create SSL Certificate Setup
**Files:** `scripts/setup-ssl.sh`, `docs/SSL_SETUP.md`
**Description:** Scripts for Let's Encrypt or self-signed SSL certificate generation.
**Rationale:** HTTPS required for OAuth and security.
**Dependencies:** Task 41
**Testing:** SSL certificate generated and working.

#### Task 43: Create Raspberry Pi Deployment Guide
**Files:** `docs/RASPBERRY_PI_DEPLOYMENT.md`, `scripts/deploy.sh`, `scripts/systemd/worktracker.service`
**Description:** Complete deployment instructions, systemd service for auto-start, UFW firewall rules.
**Rationale:** Production deployment documentation.
**Dependencies:** Task 39, Task 40, Task 41, Task 42
**Testing:** End-to-end deployment on Raspberry Pi succeeds.

### Phase 7: Testing & Polish

#### Task 44: Write Unit Tests for Business Logic
**Files:** `src/__tests__/services/*.test.ts`, `src/__tests__/stores/*.test.ts`, `src/__tests__/utils/*.test.ts`
**Description:** Jest unit tests for timer logic, analytics calculations, validation schemas.
**Rationale:** Verify core logic correctness.
**Dependencies:** Task 15, Task 16, Task 21
**Testing:** >80% coverage on business logic modules.

#### Task 45: Write Integration Tests for Supabase RLS
**Files:** `src/__tests__/integration/*.test.ts`, `supabase/tests/*.sql`
**Description:** Integration tests verifying RLS policies, database functions, auth flows.
**Rationale:** Security-critical paths must be tested.
**Dependencies:** Task 7, Task 8, Task 9
**Testing:** All RLS policies verified, auth flows tested.

#### Task 46: Write Component Tests
**Files:** `src/__tests__/components/*.test.tsx`
**Description:** React Testing Library tests for key UI components including CategoryForm with name/color/type validation.
**Rationale:** Verify component behavior and accessibility.
**Dependencies:** Task 24, Task 26, Task 28, Task 31
**Testing:** Components render correctly, interactions work.

#### Task 47: Configure CI CD Pipeline
**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
**Description:** GitHub Actions for lint, test, build, and optional deployment.
**Rationale:** Automated quality gates.
**Dependencies:** Task 44, Task 45, Task 46
**Testing:** CI passes on all PRs.

#### Task 48: Create User Documentation
**Files:** `docs/USER_GUIDE.md`, `docs/DEVELOPER_GUIDE.md`, `README.md`
**Description:** User guide, developer setup guide, project README.
**Rationale:** Enable adoption and contribution.
**Dependencies:** Task 24, Task 26, Task 28, Task 30, Task 31, Task 32, Task 43, Task 47
**Testing:** Documentation review, links work.

---

## Dependency Graph (Simplified)

```
Phase 1 (Foundation)
├── Task 1: Expo Init ────────────────────────────┐
│   ├── Task 2: Linting ──────────────────────────┤
│   ├── Task 3: Zod Schemas ──────────────────────┤ ← ANCHOR
│   ├── Task 4: Supabase Client ──────────────────┤
│   └── Task 5: Theme ────────────────────────────┤ ← ANCHOR
│       └── Task 6: Base UI ──────────────────────┤

Phase 2 (Backend)
├── Task 7: Migrations ───────────────────────────┤ ← ANCHOR
│   ├── Task 8: RLS Policies ─────────────────────┤
│   ├── Task 9: Functions ────────────────────────┤
│   ├── Task 11: Realtime ────────────────────────┤
│   └── Task 12: Seed ────────────────────────────┤
├── Task 10: OAuth Config ────────────────────────┤

Phase 3 (Features)
├── Task 13: Auth Context ────────────────────────┤
│   └── Task 14: Login Screen ────────────────────┤
├── Task 15: Timer Store ─────────────────────────┤
│   ├── Task 16: Timer Service ───────────────────┤
│   └── Task 17: Realtime Sub ────────────────────┤
├── Task 18: Categories Hooks ────────────────────┤
├── Task 19: Entries Hooks ───────────────────────┤
├── Task 20: Goals Hooks ─────────────────────────┤
├── Task 21: Analytics Hooks ─────────────────────┤
└── Task 22: Offline Queue ───────────────────────┤

Phase 4 (UI) - Highly Parallelizable
├── Task 23: Navigation ──────────────────────────┤
├── Task 24-32: Screens ──────────────────────────┤

Phase 5 (Platform)
├── Task 33-38: Platform Config ──────────────────┤

Phase 6 (Infrastructure)
├── Task 39-43: Docker/Deploy ────────────────────┤

Phase 7 (Testing)
└── Task 44-48: Tests/Docs ───────────────────────┘
```

---

## Parallelization Strategy

The following task groups can run in parallel:

**Parallel Group 1 (after Task 1):**
- Task 2 (Linting)
- Task 3 (Zod Schemas)
- Task 4 (Supabase Client)
- Task 5 (Theme)

**Parallel Group 2 (after foundational tasks):**
- Task 7 (Migrations) - independent database work
- Task 15 (Timer Store) - pure local state
- Task 33 (Expo Config) - independent configuration

**Parallel Group 3 (after backend and hooks):**
- Task 24 (Timer Screen)
- Task 26 (History Screen)
- Task 28 (Analytics Screen)
- Task 30 (Settings Screen)
- Task 31 (Categories Screen)
- Task 32 (Goals Screen)

**Parallel Group 4 (infrastructure):**
- Task 39 (Dockerfile)
- Task 34 (Electron Main)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Victory Native compatibility issues | Medium | Test early, have fallback to react-native-svg-charts |
| Electron security vulnerabilities | High | Follow Electron security checklist, enable all protections |
| RLS policy bypass | Critical | Comprehensive integration tests, penetration testing |
| Offline sync conflicts | Medium | Last-write-wins with user notification |
| Raspberry Pi performance | Medium | Resource limits, performance monitoring |

---

## Success Criteria

1. **Functional:** All core features work on all four platforms
2. **Secure:** RLS integration tests pass, Electron security audit clean
3. **Performance:** Timer updates <100ms, analytics load <2s
4. **Offline:** App remains usable without connectivity, syncs correctly on reconnect
5. **Deployable:** Docker deployment on Raspberry Pi completes successfully
6. **Tested:** >70% code coverage, all security paths tested

---

```json
[
  {
    "subject": "Initialize Expo Project with TypeScript",
    "description": "Create a new Expo project using 'npx create-expo-app@latest worktracker --template expo-template-blank-typescript'. Configure tsconfig.json with strict mode, path aliases (@/components, @/hooks, @/lib, @/screens, @/stores, @/types, @/theme, @/services, @/schemas, @/navigation, @/contexts, @/utils). Set up app.json with bundle identifiers (com.worktracker.app), app name, and initial configuration. Create .gitignore with node_modules, .expo, dist, build directories. Verify project builds and runs with 'npx expo start'. This is an ANCHOR TASK that multiple tasks depend on.",
    "depends_on_subjects": [],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [],
    "performance_requirements": [],
    "acceptance_criteria": [
      "npx expo start launches development server without errors",
      "TypeScript strict mode enabled in tsconfig.json",
      "Path aliases configured and working",
      ".gitignore excludes sensitive and build files"
    ]
  },
  {
    "subject": "Configure ESLint Prettier and Husky",
    "description": "Set up code quality tooling. Install eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-native, prettier, eslint-config-prettier, husky, lint-staged. Create .eslintrc.js extending recommended configs for TypeScript and React Native. Create .prettierrc with singleQuote: true, trailingComma: 'es5', printWidth: 100. Initialize Husky with 'npx husky install', create pre-commit hook running 'npx lint-staged'. Create lint-staged.config.js targeting *.ts,*.tsx files.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "small",
    "task_type": "infrastructure",
    "security_requirements": [],
    "performance_requirements": [],
    "acceptance_criteria": [
      "npm run lint executes without errors on clean codebase",
      "Pre-commit hook blocks commits with lint errors",
      "Prettier formats code consistently"
    ]
  },
  {
    "subject": "Define Zod Schemas and TypeScript Types",
    "description": "Create comprehensive Zod schemas with proper separation between entity schemas (for query responses) and mutation schemas (for create/update operations). Create src/types/index.ts exporting all type definitions. Create src/schemas/user.ts with UserSchema (id: uuid, email: string, name: string, timezone: string, week_start_day: number 0-6). Create src/schemas/category.ts with: CategorySchema (id: uuid, user_id: uuid, name: string 1-100 chars, color: hex string, type: string 1-50 chars for user-defined category classification like 'work', 'hobby', 'class', created_at: datetime), CreateCategorySchema (name, color, type - NO id, NO user_id, NO created_at), UpdateCategorySchema (partial of name, color, type). Create src/schemas/timeEntry.ts with: TimeEntrySchema (id, user_id, category_id, start_at, end_at nullable, duration_seconds non-negative int, notes: string max 1000, created_at, updated_at), CreateTimeEntrySchema (category_id, start_at, end_at, duration_seconds, notes - NO id, NO user_id, NO timestamps), UpdateTimeEntrySchema (partial). Create src/schemas/timer.ts with ActiveTimerSchema (id, user_id, category_id nullable, started_at, running: boolean). Create src/schemas/goal.ts with: MonthlyGoalSchema (id, user_id, month: date, category_id nullable, target_hours positive), CreateGoalSchema (month, category_id, target_hours - NO id, NO user_id), UpdateGoalSchema (partial). Export inferred types using z.infer. CRITICAL: Create/Update schemas must NEVER include server-managed fields (id, user_id, created_at, updated_at). This is an ANCHOR TASK.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "medium",
    "task_type": "general",
    "security_requirements": [
      "All string fields must have maxLength constraints",
      "UUIDs must be validated with z.string().uuid()",
      "Numeric fields must have appropriate min/max bounds",
      "Create/Update schemas must exclude server-managed fields (id, user_id, timestamps)"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "All schemas compile without TypeScript errors",
      "Unit tests verify schema validation catches invalid data",
      "Exported types match database schema specification",
      "CreateCategorySchema validates name, color, AND type fields",
      "No Create/Update schema accepts id, user_id, created_at, or updated_at"
    ]
  },
  {
    "subject": "Create Supabase Client Configuration",
    "description": "Install @supabase/supabase-js, expo-secure-store. Create src/lib/supabase.ts with platform detection. Create src/lib/supabase.native.ts using SecureStore adapter for token storage: implement custom storage object with getItem/setItem/removeItem using SecureStore.getItemAsync/setItemAsync/deleteItemAsync. Create src/lib/supabase.web.ts using localStorage (default). Export createClient with proper configuration including auth.flowType: 'pkce', auth.autoRefreshToken: true, auth.persistSession: true. Create src/lib/constants.ts for SUPABASE_URL and SUPABASE_ANON_KEY environment variables using expo-constants. Add .env.example with placeholder values.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "medium",
    "task_type": "backend_api",
    "security_requirements": [
      "Native apps must use SecureStore for auth tokens",
      "PKCE flow must be enabled",
      "Anon key must be loaded from environment variables, not hardcoded"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Supabase client initializes without errors on web",
      "Supabase client initializes without errors on native",
      "SecureStore adapter correctly persists and retrieves tokens"
    ]
  },
  {
    "subject": "Set Up Theme and Design Tokens",
    "description": "Create src/theme/colors.ts with dark mode palette: background (#0F0F0F), surface (#1A1A1A), surfaceVariant (#252525), primary (#6366F1 indigo), primaryVariant (#4F46E5), secondary (#22D3EE cyan), error (#EF4444), warning (#F59E0B), success (#10B981), text (#FFFFFF), textSecondary (#A1A1AA), textMuted (#71717A), border (#27272A). Create src/theme/spacing.ts with scale: xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48. Create src/theme/typography.ts with fontSizes (xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32, display: 48), fontWeights (normal: '400', medium: '500', semibold: '600', bold: '700'). Create src/theme/index.ts consolidating all exports with a theme object and ThemeContext for future theming support. This is an ANCHOR TASK.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "small",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Theme exports all required tokens",
      "TypeScript types are correct for all theme values",
      "Colors meet WCAG AA contrast requirements for text"
    ]
  },
  {
    "subject": "Create Base UI Components",
    "description": "Create src/components/ui/Button.tsx with variants (primary, secondary, outline, ghost, danger), sizes (sm, md, lg), loading state, disabled state, full accessibility props (accessibilityRole='button', accessibilityState). Create src/components/ui/Input.tsx with label, error message, multiline support, secure text entry option, themed styling. Create src/components/ui/Card.tsx with elevation, padding variants, pressable option. Create src/components/ui/Text.tsx with variants (body, caption, heading, display) mapping to typography tokens. Create src/components/ui/Spinner.tsx for loading states. Create src/components/ui/ColorPicker.tsx with preset palette of 12 colors + custom hex input. Create src/components/ui/index.ts barrel export. All components must use theme tokens for styling via StyleSheet.create.",
    "depends_on_subjects": ["Set Up Theme and Design Tokens"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Components should not re-render unnecessarily - use React.memo where appropriate"
    ],
    "acceptance_criteria": [
      "All components render correctly with all variant combinations",
      "Accessibility props are correctly applied",
      "Components use theme tokens consistently",
      "Component tests pass with React Testing Library"
    ]
  },
  {
    "subject": "Create Supabase Database Migrations",
    "description": "Create supabase/ directory structure. Create supabase/migrations/20240101000001_create_users_table.sql: CREATE TABLE public.users (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text NOT NULL, name text, timezone text DEFAULT 'UTC', week_start_day int DEFAULT 1 CHECK (week_start_day >= 0 AND week_start_day <= 6), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()); Create index on email. Create supabase/migrations/20240101000002_create_categories.sql: categories (id uuid PK DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE, name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100), color text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'), type text NOT NULL CHECK (char_length(type) BETWEEN 1 AND 50), created_at timestamptz DEFAULT now()); Create index on user_id. Create supabase/migrations/20240101000003_create_time_entries.sql with all columns per spec including user_id uuid NOT NULL DEFAULT auth.uid(), category_id REFERENCES categories(id) ON DELETE SET NULL (NOT CASCADE - preserves entries when category deleted), indexes on (user_id, start_at), (user_id, category_id). Create supabase/migrations/20240101000004_create_active_timers.sql with user_id uuid NOT NULL DEFAULT auth.uid() and UNIQUE constraint on user_id. Create supabase/migrations/20240101000005_create_monthly_goals.sql with user_id uuid NOT NULL DEFAULT auth.uid(). IMPORTANT: For monthly_goals uniqueness with nullable category_id, create TWO constraints: (1) Partial unique index for overall goals: CREATE UNIQUE INDEX idx_monthly_goals_overall_unique ON monthly_goals (user_id, month) WHERE category_id IS NULL; (2) Partial unique index for per-category goals: CREATE UNIQUE INDEX idx_monthly_goals_category_unique ON monthly_goals (user_id, month, category_id) WHERE category_id IS NOT NULL. Do NOT use a simple UNIQUE (user_id, month, category_id) as PostgreSQL allows multiple NULLs. CRITICAL: All tables with user_id must use DEFAULT auth.uid() to ensure user_id is always server-derived and never client-provided. This is an ANCHOR TASK.",
    "depends_on_subjects": ["Define Zod Schemas and TypeScript Types"],
    "estimated_complexity": "medium",
    "task_type": "database",
    "security_requirements": [
      "All tables must have user_id column for RLS",
      "Foreign keys from users table must CASCADE on delete (user deletion removes all user data)",
      "time_entries.category_id must use ON DELETE SET NULL (preserves time entries when category deleted)",
      "CHECK constraints must validate data integrity",
      "categories.type column must have CHECK constraint for 1-50 chars",
      "monthly_goals must use partial unique indexes for NULL-safe uniqueness"
    ],
    "performance_requirements": [
      "Indexes must be created on frequently queried columns",
      "user_id must be indexed on all tables"
    ],
    "acceptance_criteria": [
      "All migrations apply cleanly to fresh database",
      "Schema matches specification exactly",
      "All constraints and indexes are created",
      "All user_id columns have DEFAULT auth.uid() to enforce server-side derivation",
      "categories table includes type column with appropriate CHECK constraint"
    ]
  },
  {
    "subject": "Implement Row Level Security Policies",
    "description": "Create supabase/migrations/20240101000006_rls_policies.sql. Enable RLS on all tables: ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; (repeat for all tables). Create policies for users: SELECT (auth.uid() = id), UPDATE (auth.uid() = id), INSERT (auth.uid() = id). Create policies for categories: SELECT (auth.uid() = user_id), INSERT (auth.uid() = user_id), UPDATE (auth.uid() = user_id), DELETE (auth.uid() = user_id). Identical pattern for time_entries, active_timers, monthly_goals. For INSERT policies, ensure user_id column gets DEFAULT auth.uid() or policy enforces user_id = auth.uid(). Add policy preventing UPDATE of user_id column on all tables. Document each policy with COMMENT.",
    "depends_on_subjects": ["Create Supabase Database Migrations"],
    "estimated_complexity": "medium",
    "task_type": "security",
    "security_requirements": [
      "Every table must have RLS enabled",
      "SELECT must filter by user_id = auth.uid()",
      "INSERT must enforce user_id = auth.uid()",
      "UPDATE must verify user_id = auth.uid() AND cannot change user_id",
      "DELETE must verify user_id = auth.uid()"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "RLS is enabled on all user data tables",
      "Unauthenticated requests return zero rows",
      "Users cannot access other users' data",
      "Integration tests verify all RLS policies"
    ]
  },
  {
    "subject": "Create Database Functions and Triggers",
    "description": "Create supabase/migrations/20240101000007_functions.sql. Create trigger function update_updated_at(): CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql; Apply to users and time_entries tables. Create function to handle user creation from auth.users: CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ BEGIN INSERT INTO public.users (id, email, name) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name'); RETURN NEW; END; $$; Create trigger on auth.users AFTER INSERT. Create function stop_timer_and_create_entry(p_notes text DEFAULT NULL) that atomically: 1) Gets active timer for current user, 2) Calculates duration, 3) Inserts time_entry, 4) Deletes active_timer, 5) Returns the new time_entry. CRITICAL: ALL SECURITY DEFINER functions MUST include 'SET search_path = public' (or appropriate schema list) to prevent search_path injection attacks.",
    "depends_on_subjects": ["Create Supabase Database Migrations"],
    "estimated_complexity": "medium",
    "task_type": "database",
    "security_requirements": [
      "ALL SECURITY DEFINER functions MUST include SET search_path = <schemas> to prevent search_path injection",
      "handle_new_user() must use SET search_path = public, auth",
      "stop_timer_and_create_entry() must use SET search_path = public",
      "Functions must validate auth.uid() is not null",
      "Timer conversion must be atomic (transaction)"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "updated_at trigger fires on UPDATE",
      "New auth users automatically get public.users row",
      "stop_timer_and_create_entry works atomically",
      "Functions handle edge cases (no active timer, etc.)"
    ]
  },
  {
    "subject": "Configure Supabase Auth with Google OAuth",
    "description": "Create docs/SUPABASE_SETUP.md with complete instructions: 1) Create Supabase project, 2) Enable Google OAuth provider in Authentication settings, 3) Configure Google Cloud Console OAuth credentials (create project, create OAuth 2.0 credentials for Web application, set authorized redirect URIs for web and mobile). NOTE: Google+ API is DEPRECATED - do NOT reference it. For basic OAuth, no additional APIs need to be enabled. If you need profile data beyond email, enable 'Google People API' instead. 4) Set redirect URIs in Supabase (https://your-project.supabase.co/auth/v1/callback), 5) Configure site URL and redirect URLs. Create supabase/config.toml with local development settings. Create .env.example with SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET placeholders. Document mobile deep link schemes (worktracker://) for OAuth redirect.",
    "depends_on_subjects": ["Create Supabase Client Configuration"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "Document PKCE requirement for mobile OAuth",
      "Include security checklist for redirect URI configuration",
      "Warn about localhost redirect URIs in production"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Documentation is complete and accurate",
      "Following guide results in working OAuth flow",
      "All environment variables are documented"
    ]
  },
  {
    "subject": "Create Supabase Realtime Configuration",
    "description": "Create supabase/migrations/20240101000008_realtime_config.sql. Enable realtime on active_timers table: ALTER PUBLICATION supabase_realtime ADD TABLE active_timers; Ensure RLS policies apply to realtime (they do by default in Supabase). Document in comments that realtime subscriptions are filtered by RLS. Create src/lib/realtime.ts with helper function to create typed channel subscription for active_timers with proper TypeScript types for payload (old_record, new_record, eventType). Include reconnection logic and error handling.",
    "depends_on_subjects": ["Create Supabase Database Migrations", "Implement Row Level Security Policies"],
    "estimated_complexity": "small",
    "task_type": "backend_api",
    "security_requirements": [
      "Realtime subscriptions must be filtered by RLS",
      "Document that users only receive their own timer events"
    ],
    "performance_requirements": [
      "Implement reconnection with exponential backoff"
    ],
    "acceptance_criteria": [
      "Realtime is enabled on active_timers",
      "Subscription helper is typed correctly",
      "Users only receive events for their own data"
    ]
  },
  {
    "subject": "Create Database Seed Script",
    "description": "Create supabase/seed.sql with development seed data. DO NOT create pre-seeded categories (per user requirement). Create test users via auth.users if running locally, or document manual creation. Create scripts/seed-dev.ts using Supabase client with service role key to: 1) Create test user accounts, 2) Optionally create sample time entries for testing (clearly marked as removable). Include README section in docs/DEVELOPMENT.md explaining seed script usage. Ensure seed script is idempotent (can run multiple times safely).",
    "depends_on_subjects": ["Create Supabase Database Migrations"],
    "estimated_complexity": "small",
    "task_type": "database",
    "security_requirements": [
      "Service role key must only be used in development scripts",
      "Seed script must not run in production"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Seed script creates test data successfully",
      "No pre-seeded categories are created",
      "Script is idempotent"
    ]
  },
  {
    "subject": "Implement Authentication Context and Hooks",
    "description": "Create src/contexts/AuthContext.tsx with AuthProvider wrapping app, providing: user (User | null), session (Session | null), loading (boolean), signInWithGoogle(), signOut(), isAuthenticated. Use useEffect to listen to auth state changes via supabase.auth.onAuthStateChange(). Create src/hooks/useAuth.ts returning context value. Create src/hooks/useSession.ts for session-specific operations (refresh, check expiry). Handle loading states during initial auth check. Implement proper cleanup of auth listeners on unmount. Store user profile in context after fetching from public.users table.",
    "depends_on_subjects": ["Create Supabase Client Configuration", "Configure Supabase Auth with Google OAuth"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Session refresh must happen automatically",
      "Sign out must clear all local storage",
      "Auth state must be synced across tabs (web)"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Auth context provides correct state after login",
      "Auth context updates on session changes",
      "Sign out clears all auth state"
    ]
  },
  {
    "subject": "Create Login Screen with Google OAuth",
    "description": "Create src/screens/LoginScreen.tsx with centered layout, app logo/title, Google sign-in button, loading state during auth. Create src/components/auth/GoogleSignInButton.tsx using themed Button component with Google icon (from @expo/vector-icons). Implement signInWithGoogle using supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: getRedirectUrl() } }). Handle platform-specific redirect URLs (web uses window.location.origin, native uses expo-linking scheme). Show error toast on auth failure. Add loading spinner during OAuth flow. Navigate to main app on successful auth.",
    "depends_on_subjects": ["Create Base UI Components", "Implement Authentication Context and Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "PKCE must be used for OAuth flow",
      "Error messages must not leak sensitive information"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Login screen renders correctly",
      "Google OAuth flow initiates on button press",
      "Loading state shows during auth",
      "Successful auth navigates to main app"
    ]
  },
  {
    "subject": "Implement Timer Zustand Store",
    "description": "Install zustand and zustand/middleware. Create src/stores/timerStore.ts with state: activeTimer (ActiveTimer | null), localElapsed (number in seconds), isRunning (boolean), offlineQueue (QueuedAction[]). Implement actions: setActiveTimer(timer), startLocalTick(), stopLocalTick(), queueAction(action), clearQueue(), syncFromServer(timer). Use persist middleware with AsyncStorage for offline persistence. Implement elapsed time calculation: if activeTimer exists, elapsed = Date.now() - new Date(activeTimer.started_at).getTime(). Create interval for updating localElapsed every second when running. Handle timezone correctly using UTC timestamps.",
    "depends_on_subjects": ["Define Zod Schemas and TypeScript Types"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Queued actions must be re-validated on sync"
    ],
    "performance_requirements": [
      "Local tick interval should be cleaned up properly",
      "Avoid unnecessary re-renders with selector patterns"
    ],
    "acceptance_criteria": [
      "Store correctly calculates elapsed time from started_at",
      "Store persists to AsyncStorage",
      "Offline queue stores actions correctly",
      "Unit tests verify all state transitions"
    ]
  },
  {
    "subject": "Create Timer Service with Supabase Integration",
    "description": "Create src/services/timerService.ts with functions: startTimer(categoryId?: string): Promise<ActiveTimer> - inserts into active_timers WITHOUT sending started_at (database DEFAULT now() enforces server-side timestamp), running = true; stopTimer(notes?: string): Promise<TimeEntry> - calls stop_timer_and_create_entry RPC function; pauseTimer(): same as stop but allows restart; getActiveTimer(): Promise<ActiveTimer | null> - fetches current user's active timer; syncTimer(localState, serverState): handles conflict resolution (server wins with notification). All functions use Supabase client. IMPORTANT: Validate category_id using a dedicated schema: CategoryIdSchema = z.string().uuid().nullable().optional() - do NOT use CreateCategorySchema which is for category entity creation. Handle errors gracefully. Return typed results. Implement optimistic updates pattern (update local immediately, rollback on error).",
    "depends_on_subjects": ["Create Supabase Client Configuration", "Create Database Functions and Triggers", "Implement Timer Zustand Store"],
    "estimated_complexity": "medium",
    "task_type": "backend_api",
    "security_requirements": [
      "All inputs must be validated with Zod before sending to Supabase",
      "Server response must be validated before updating local state"
    ],
    "performance_requirements": [
      "Implement optimistic updates for perceived performance"
    ],
    "acceptance_criteria": [
      "startTimer creates active_timers record",
      "stopTimer atomically creates time_entry and deletes active_timer",
      "getActiveTimer returns null when no timer",
      "Error handling returns meaningful messages"
    ]
  },
  {
    "subject": "Implement Real-time Timer Subscription",
    "description": "Create src/hooks/useRealtimeTimer.ts. Subscribe to active_timers table changes for current user using supabase.channel('active_timers').on('postgres_changes', { event: '*', schema: 'public', table: 'active_timers', filter: `user_id=eq.${userId}` }, callback).subscribe(). On INSERT/UPDATE: update timer store with new data. On DELETE: clear active timer in store. Handle subscription errors with reconnection. Clean up subscription on unmount. Show toast notification when timer changes from another device. Implement connection status indicator (connected/reconnecting/disconnected).",
    "depends_on_subjects": ["Create Supabase Realtime Configuration", "Implement Timer Zustand Store"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Subscription must include user_id filter to prevent data leaks"
    ],
    "performance_requirements": [
      "Reconnection should use exponential backoff",
      "Avoid re-subscribing unnecessarily"
    ],
    "acceptance_criteria": [
      "Timer updates appear in real-time across devices",
      "Connection status is tracked",
      "Subscription cleans up on unmount",
      "Reconnection works after network interruption"
    ]
  },
  {
    "subject": "Create Categories TanStack Query Hooks",
    "description": "Install @tanstack/react-query. Create src/lib/queryClient.ts with configured QueryClient (staleTime: 5 minutes, cacheTime: 30 minutes). Create src/hooks/useCategories.ts with useQuery for fetching all user categories: queryKey: ['categories'], queryFn fetches from supabase.from('categories').select('*').order('name'). Create src/hooks/useCategoryMutations.ts with useMutation hooks: useCreateCategory (validates with CreateCategorySchema), useUpdateCategory (validates with UpdateCategorySchema), useDeleteCategory. IMPORTANT: Mutation hooks must validate with Create/Update schemas, NOT full CategorySchema. Implement optimistic updates using onMutate/onError/onSettled pattern. Invalidate ['categories'] query on mutation success.",
    "depends_on_subjects": ["Define Zod Schemas and TypeScript Types", "Create Supabase Client Configuration"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Validate category data with CreateCategorySchema for creates",
      "Validate category data with UpdateCategorySchema for updates",
      "Never include user_id in mutation payload - it's server-derived"
    ],
    "performance_requirements": [
      "Implement optimistic updates for instant UI feedback",
      "Use appropriate staleTime to minimize refetches"
    ],
    "acceptance_criteria": [
      "useCategories returns user's categories",
      "Mutations update cache optimistically",
      "Errors rollback optimistic updates",
      "Loading and error states are handled",
      "Create mutation validates name, color, AND type fields"
    ]
  },
  {
    "subject": "Create Time Entries TanStack Query Hooks",
    "description": "Create src/hooks/useTimeEntries.ts with useInfiniteQuery for paginated entries: queryKey: ['timeEntries', filters], implement cursor-based pagination using created_at. Support filters: dateRange (start, end), categoryId, searchNotes, minDuration, maxDuration. Create src/hooks/useTimeEntryMutations.ts with useCreateEntry (validates with CreateTimeEntrySchema), useUpdateEntry (validates with UpdateTimeEntrySchema), useDeleteEntry mutations with optimistic updates. Create src/hooks/useTimeEntrySummary.ts for aggregated data (total hours in range, entries count). All queries filter by user's data (handled by RLS). IMPORTANT: Use Create/Update schemas for mutations, never full TimeEntrySchema.",
    "depends_on_subjects": ["Define Zod Schemas and TypeScript Types", "Create Supabase Client Configuration"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Validate time entry data with CreateTimeEntrySchema for creates",
      "Validate time entry data with UpdateTimeEntrySchema for updates",
      "Ensure duration_seconds cannot be negative",
      "Never include user_id in mutation payload"
    ],
    "performance_requirements": [
      "Use cursor-based pagination for large datasets",
      "Implement proper query key structure for cache management"
    ],
    "acceptance_criteria": [
      "Infinite scroll pagination works correctly",
      "All four filters work independently and combined",
      "Mutations invalidate relevant queries",
      "Summary calculations are accurate"
    ]
  },
  {
    "subject": "Implement Goals TanStack Query Hooks",
    "description": "Create src/hooks/useGoals.ts with useQuery for monthly goals: queryKey: ['goals', month], fetches goals for specified month including overall (category_id IS NULL) and per-category goals. Create src/hooks/useGoalProgress.ts that combines goals with time entries summary to calculate: targetHours, actualHours, progressPercent, remainingHours, dailyRequiredToMeetGoal. Create src/hooks/useGoalMutations.ts with SEPARATE mutation handlers for overall vs per-category goals to handle partial unique indexes correctly: (1) useSetOverallGoal: first queries for existing goal WHERE category_id IS NULL, then performs INSERT or UPDATE accordingly; (2) useSetCategoryGoal: first queries for existing goal WHERE category_id = :id, then performs INSERT or UPDATE accordingly. Alternatively, implement a single set_goal RPC function in the database that handles the conditional logic server-side. Do NOT use simple upsert with ON CONFLICT on (user_id, month, category_id) as this fails with NULL category_id. Create useDeleteGoal mutation. IMPORTANT: Use CreateGoalSchema/UpdateGoalSchema for input validation.",
    "depends_on_subjects": ["Define Zod Schemas and TypeScript Types", "Create Supabase Client Configuration", "Create Time Entries TanStack Query Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Validate goal data with CreateGoalSchema for creates",
      "target_hours must be positive",
      "Never include user_id in mutation payload"
    ],
    "performance_requirements": [
      "Progress calculation should be memoized"
    ],
    "acceptance_criteria": [
      "Goals query returns both overall and per-category goals",
      "Progress calculation is accurate",
      "Overall goals (category_id IS NULL) are correctly created/updated using query-then-insert/update pattern or RPC",
      "Per-category goals (category_id IS NOT NULL) are correctly created/updated using query-then-insert/update pattern or RPC",
      "Edge cases handled (no entries yet, goal exceeded)"
    ]
  },
  {
    "subject": "Create Analytics Query Hooks",
    "description": "Create src/hooks/useAnalytics.ts with multiple queries: useDailyTotals(days: number) - last N days with date and total_seconds; useWeeklyTotals(weeks: number) - last N weeks with week_start and total_seconds; useMonthlyTotals(months: number) - last N months with month and total_seconds; useHourOfDayDistribution() - array of 24 values for hour prominence; useDayOfWeekDistribution() - array of 7 values for day prominence. Queries use Supabase SQL functions or RPC for efficient aggregation. Respect user's week_start_day and timezone settings. Create src/utils/analytics.ts with helper functions for date range calculations, week boundaries, etc.",
    "depends_on_subjects": ["Create Supabase Client Configuration", "Create Time Entries TanStack Query Hooks"],
    "estimated_complexity": "large",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Use database-level aggregation, not client-side",
      "Cache analytics with longer staleTime (15 minutes)"
    ],
    "acceptance_criteria": [
      "Daily totals accurate for last 30 days",
      "Weekly totals respect user's week_start_day",
      "Hour/day distribution data is correct",
      "Timezone handling is correct"
    ]
  },
  {
    "subject": "Implement Offline Queue and Sync",
    "description": "Create src/services/offlineQueue.ts with QueuedAction type (action: 'create_entry' | 'update_entry' | 'delete_entry', payload, timestamp, id). IMPORTANT: Do NOT queue 'start_timer' or 'stop_timer' actions because the server enforces server-side timestamps (started_at = now()). For offline timer usage: (1) When user starts timer offline, track start time locally but do NOT queue a start_timer action; (2) When user stops timer offline, calculate duration locally and queue as a 'create_entry' action with the calculated duration - this bypasses the timer system entirely and creates a manual entry; (3) Warn user that offline timer sessions will be recorded as manual entries. Create queue management: addToQueue(action), getQueue(), removeFromQueue(id), clearQueue(). Persist queue to AsyncStorage. Create src/hooks/useOfflineSync.ts that: 1) Monitors network connectivity using @react-native-community/netinfo, 2) On reconnect, processes queue in order, 3) Handles conflicts (server state wins, notify user), 4) Retries failed syncs with exponential backoff. Create src/hooks/useNetworkStatus.ts exposing isOnline, isConnected. Update timer store to handle offline mode gracefully. Re-validate all queued data with appropriate Zod schemas before syncing.",
    "depends_on_subjects": ["Implement Timer Zustand Store", "Create Timer Service with Supabase Integration", "Create Time Entries TanStack Query Hooks"],
    "estimated_complexity": "large",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Re-validate all queued data before syncing using Create/Update schemas",
      "Clear queue on logout"
    ],
    "performance_requirements": [
      "Process queue in background without blocking UI",
      "Implement exponential backoff for retries"
    ],
    "acceptance_criteria": [
      "Actions are queued when offline",
      "Queue syncs automatically on reconnect",
      "Conflicts are resolved server-wins",
      "User is notified of sync status"
    ]
  },
  {
    "subject": "Create Navigation Structure",
    "description": "Install @react-navigation/native, @react-navigation/bottom-tabs, @react-navigation/native-stack, react-native-screens, react-native-safe-area-context. Create src/navigation/types.ts with typed navigation params: RootStackParamList (Login, Main, EntryEdit), MainTabParamList (Timer, History, Analytics, Categories, Goals, Settings). Create src/navigation/RootNavigator.tsx with conditional rendering: if !isAuthenticated show LoginScreen, else show MainNavigator. Create src/navigation/MainTabs.tsx with bottom tab navigator, themed tab bar, icons from @expo/vector-icons. Create src/navigation/index.ts exporting NavigationContainer wrapper with theme integration.",
    "depends_on_subjects": ["Implement Authentication Context and Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Authenticated routes must not be accessible without session"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Navigation types are fully typed",
      "Auth gate works correctly",
      "Tab bar renders with correct icons and theme"
    ]
  },
  {
    "subject": "Build Timer Screen",
    "description": "Create src/screens/TimerScreen.tsx as main timer interface. Create src/components/timer/TimerDisplay.tsx showing large formatted time (HH:MM:SS), updates every second, shows 'No active timer' when idle. Create src/components/timer/TimerControls.tsx with Start/Pause/Stop buttons, disabled states based on timer status. Create src/components/timer/CategorySelector.tsx as modal/dropdown for selecting category before starting timer, shows user's categories with colors AND types, allows 'No category' option. Integrate useRealtimeTimer hook for live updates. Show connection status indicator. Add quick notes input for when stopping timer. Responsive layout that works on phone and tablet.",
    "depends_on_subjects": ["Create Base UI Components", "Create Timer Service with Supabase Integration", "Implement Real-time Timer Subscription", "Create Categories TanStack Query Hooks"],
    "estimated_complexity": "large",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Timer display must update smoothly every second",
      "Avoid re-rendering entire screen on tick"
    ],
    "acceptance_criteria": [
      "Timer displays elapsed time correctly",
      "Start/Pause/Stop controls work",
      "Category can be selected before starting",
      "Notes can be added when stopping",
      "Real-time sync works across devices",
      "Category selector shows name, color, and type"
    ]
  },
  {
    "subject": "Build Quick Entry Component",
    "description": "Create src/components/timer/QuickEntry.tsx for manual time entry creation. Include: category selector (required), date picker for entry date, start time picker, end time picker OR duration input (toggle between modes), notes text input (optional, max 1000 chars). Validate with CreateTimeEntrySchema: end_at > start_at, duration > 0, date not in future. Show calculated duration when using start/end times. Use useCreateEntry mutation. Show success toast and clear form on submit. Handle validation errors with inline messages.",
    "depends_on_subjects": ["Create Base UI Components", "Create Time Entries TanStack Query Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Validate all inputs client-side with CreateTimeEntrySchema",
      "Sanitize notes input"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Form validates all inputs",
      "Duration calculates correctly from times",
      "Entry is created successfully",
      "Form clears after submission"
    ]
  },
  {
    "subject": "Build History Screen",
    "description": "Create src/screens/HistoryScreen.tsx with entry list and filters. Create src/components/history/HistoryFilters.tsx with: date range picker (from/to), category multi-select dropdown, notes search input (debounced 300ms), duration range slider (min/max hours). Create src/components/history/EntryList.tsx using FlatList with infinite scroll, pull-to-refresh, empty state. Create src/components/history/EntryCard.tsx showing: category color chip, category type badge, date, start-end times, duration, notes preview (truncated), edit button. Use useInfiniteQuery with filters. Group entries by date with section headers. Show loading skeleton during fetch.",
    "depends_on_subjects": ["Create Base UI Components", "Create Time Entries TanStack Query Hooks"],
    "estimated_complexity": "large",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Use FlatList virtualization for long lists",
      "Debounce search input",
      "Use skeleton loading for better perceived performance"
    ],
    "acceptance_criteria": [
      "All four filters work correctly",
      "Infinite scroll loads more entries",
      "Pull-to-refresh works",
      "Entries grouped by date",
      "Empty state shows when no entries",
      "Category type is displayed on entry cards"
    ]
  },
  {
    "subject": "Build Entry Edit Modal",
    "description": "Create src/components/history/EntryEditModal.tsx as modal/bottom sheet for editing time entries. Pre-fill form with existing entry data. Allow editing: category, start_at, end_at, notes. Show delete button with confirmation dialog. Validate changes with UpdateTimeEntrySchema. Use useUpdateEntry and useDeleteEntry mutations. Close modal and show toast on success. Handle optimistic updates with rollback on error. Prevent editing entries from other users (should not be possible due to RLS, but defensive check).",
    "depends_on_subjects": ["Create Base UI Components", "Create Time Entries TanStack Query Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Defensive check that entry belongs to current user",
      "Validate all edited fields with UpdateTimeEntrySchema"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Modal opens with pre-filled data",
      "Changes save correctly",
      "Delete requires confirmation",
      "Optimistic updates work",
      "Modal closes on success"
    ]
  },
  {
    "subject": "Build Analytics Dashboard Screen",
    "description": "Create src/screens/AnalyticsScreen.tsx as scrollable dashboard. Create src/components/analytics/KPICards.tsx showing: Today's hours, This week's hours, This month's hours, Streak (consecutive days with entries). Create src/components/analytics/GoalProgress.tsx showing: overall monthly goal as progress bar with percentage, per-category goals as smaller progress bars, days remaining in month, required daily pace to meet goal. Use useGoalProgress hook. Create chart containers for Daily/Weekly/Monthly/Heatmap charts (charts implemented in separate task). Responsive grid layout: 2 columns on tablet/desktop, 1 column on phone.",
    "depends_on_subjects": ["Create Base UI Components", "Implement Goals TanStack Query Hooks", "Create Analytics Query Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Lazy load charts below the fold",
      "Use skeleton loading for async data"
    ],
    "acceptance_criteria": [
      "KPI cards show correct values",
      "Goal progress accurate",
      "Layout responsive across screen sizes",
      "Loading states handled"
    ]
  },
  {
    "subject": "Implement Victory Native Charts",
    "description": "Install victory-native, react-native-svg. Create src/components/charts/DailyChart.tsx as bar chart showing last 30 days, x-axis as dates (abbreviated), y-axis as hours, themed colors. Create src/components/charts/WeeklyChart.tsx as bar chart for last 12 weeks with week labels. Create src/components/charts/MonthlyChart.tsx as bar chart for last 12 months. Create src/components/charts/HeatmapChart.tsx showing hour-of-day (y) vs day-of-week (x) grid with color intensity based on logged hours (use VictoryHeatmap or custom implementation with VictoryScatter). All charts use dark theme colors, have tooltips on touch, and handle empty data gracefully. Create src/components/charts/ChartContainer.tsx wrapper with loading state and error boundary.",
    "depends_on_subjects": ["Create Analytics Query Hooks"],
    "estimated_complexity": "large",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Charts should render within 500ms",
      "Use memoization to prevent unnecessary re-renders"
    ],
    "acceptance_criteria": [
      "All chart types render correctly",
      "Charts work on both native and web",
      "Touch interactions work (tooltips)",
      "Empty state handled gracefully",
      "Theme colors applied"
    ]
  },
  {
    "subject": "Build Settings Screen",
    "description": "Create src/screens/SettingsScreen.tsx with settings sections. Create src/components/settings/TimezoneSelector.tsx: searchable dropdown of IANA timezones, current timezone highlighted, updates user profile on selection. Create src/components/settings/WeekStartSelector.tsx: picker for week start day (Sunday=0 through Saturday=6), labeled with day names. Create src/components/settings/GoalDefaults.tsx: input for default monthly goal hours. Create src/components/settings/AccountSection.tsx showing user email, profile photo, sign out button. Create src/hooks/useUserSettings.ts for fetching and updating user profile. Include app version display at bottom.",
    "depends_on_subjects": ["Create Base UI Components", "Implement Authentication Context and Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Sign out must clear all local data including offline queue"
    ],
    "performance_requirements": [
      "Timezone list should be searchable/filterable"
    ],
    "acceptance_criteria": [
      "Timezone updates and persists",
      "Week start day updates and affects analytics",
      "Sign out works and navigates to login",
      "Settings persist across app restarts"
    ]
  },
  {
    "subject": "Build Category Management Screen",
    "description": "Create src/screens/CategoriesScreen.tsx for managing user-defined categories. Create src/components/categories/CategoryList.tsx showing all categories as cards with color swatch, name, type badge, entry count. Create src/components/categories/CategoryForm.tsx as modal for create/edit with: name input (required, 1-100 chars), color picker (preset palette of 12 colors + custom hex input), type input (required, 1-50 chars, e.g., 'work', 'hobby', 'class', or custom free-text). Validate with CreateCategorySchema for creates and UpdateCategorySchema for edits. Show delete button on edit with confirmation. When deleting a category with entries: (1) Warn user that entries will have their category set to NULL (orphaned but preserved), (2) Offer option to reassign entries to another category before deletion, (3) Show count of affected entries. NOTE: time_entries.category_id uses ON DELETE SET NULL so entries are NEVER lost when deleting categories. Handle category with active timer (force stop timer before delete). Empty state with prompt to create first category. IMPORTANT: type field is REQUIRED and must be included in both create and edit forms.",
    "depends_on_subjects": ["Create Base UI Components", "Create Categories TanStack Query Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Validate category name length (1-100 chars)",
      "Validate category type length (1-50 chars)",
      "Validate color is valid hex"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Categories display with colors AND types",
      "Create form includes name, color, AND type fields",
      "Edit form allows editing name, color, AND type",
      "Validation messages shown for all three fields",
      "Delete warns about existing entries",
      "Empty state encourages creation"
    ]
  },
  {
    "subject": "Build Goals Management Screen",
    "description": "Create src/screens/GoalsScreen.tsx for setting monthly goals. Show month picker (current month default, can navigate to future months). Create src/components/goals/GoalForm.tsx for setting: overall monthly goal (hours, applies to total time), per-category goals (select category, set hours). Validates with CreateGoalSchema. Create src/components/goals/GoalList.tsx showing all goals for selected month with progress if current/past month. Allow editing and deleting goals. Validate: target_hours > 0, no duplicate category goals per month. Show current progress toward each goal for current month. Include quick-set buttons for common values (20h, 40h, 80h, etc.).",
    "depends_on_subjects": ["Create Base UI Components", "Implement Goals TanStack Query Hooks"],
    "estimated_complexity": "medium",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Validate target_hours is positive using CreateGoalSchema"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Overall and per-category goals can be set",
      "Goals display with progress",
      "Edit and delete work correctly",
      "Month navigation works",
      "Validation prevents invalid goals"
    ]
  },
  {
    "subject": "Configure Expo for Multi-Platform Build",
    "description": "Update app.json with complete configuration: name, slug, version, orientation, icon, splash (backgroundColor matching theme), iOS (bundleIdentifier: com.worktracker.app, supportsTablet: true, infoPlist for Google Sign-In), android (package: com.worktracker.app, adaptiveIcon, intentFilters for OAuth), web (favicon, bundler: metro). Create eas.json with build profiles: development (development client), preview (internal distribution), production (store submission). Configure environment variables in eas.json (SUPABASE_URL, SUPABASE_ANON_KEY). Add scripts to package.json: build:ios, build:android, build:web. Document EAS setup in docs/MOBILE_BUILD.md.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "API keys must be environment variables, not committed",
      "Production builds must not include development keys"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "EAS build succeeds for iOS",
      "EAS build succeeds for Android",
      "Web build succeeds",
      "OAuth redirect URIs configured correctly"
    ]
  },
  {
    "subject": "Create Electron Main Process",
    "description": "Create electron/ directory. Create electron/main.ts with BrowserWindow configuration: width: 1200, height: 800, minWidth: 400, minHeight: 600, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }. Load the web build URL (development: localhost:19006, production: file://). Create electron/preload.ts exposing safe APIs via contextBridge: versions (node, chrome, electron), platform. Handle window close, minimize, maximize. Implement single instance lock. Add Content Security Policy header. Create electron/electron-builder.yml for packaging config.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "contextIsolation must be true",
      "nodeIntegration must be false",
      "Use preload script with contextBridge only",
      "Enable webSecurity",
      "Set strict Content Security Policy"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Electron app launches and loads web build",
      "Security settings verified with Electron DevTools",
      "Window controls work correctly",
      "Single instance enforced"
    ]
  },
  {
    "subject": "Configure Electron Build Pipeline",
    "description": "Install electron, electron-builder, concurrently as devDependencies. Create electron/forge.config.ts (or use electron-builder.yml) with: appId: com.worktracker.desktop, productName: WorkTracker, mac: { category: public.app-category.productivity, target: [dmg, zip], hardenedRuntime: true }, asar: true. Configure code signing for macOS (document process, can be self-signed for personal use). Add package.json scripts: electron:dev (runs web + electron concurrently), electron:build (builds web then packages Electron), electron:package (creates distributable). Create docs/ELECTRON_BUILD.md with build and signing instructions.",
    "depends_on_subjects": ["Create Electron Main Process"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "Enable hardened runtime for macOS",
      "Sign app if distributing outside App Store"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "npm run electron:dev starts development environment",
      "npm run electron:build creates macOS .app",
      "Built app runs correctly",
      "Code signing documented"
    ]
  },
  {
    "subject": "Implement Platform-Specific Storage",
    "description": "Create src/lib/storage/index.ts with Storage interface: getItem(key): Promise<string | null>, setItem(key, value): Promise<void>, removeItem(key): Promise<void>, clear(): Promise<void>. Create src/lib/storage/storage.native.ts implementing Storage using @react-native-async-storage/async-storage for general data and expo-secure-store for sensitive data (auth tokens). Create src/lib/storage/storage.web.ts using localStorage with try-catch for private browsing. Create src/lib/storage/secureStorage.ts abstracting secure storage (SecureStore on native, localStorage with warning on web). Export platform-appropriate implementation using .native.ts/.web.ts convention.",
    "depends_on_subjects": ["Create Supabase Client Configuration"],
    "estimated_complexity": "small",
    "task_type": "frontend_ui",
    "security_requirements": [
      "Auth tokens must use SecureStore on native",
      "Log warning if secure storage unavailable on web"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Storage works on native platforms",
      "Storage works on web",
      "Secure storage used for sensitive data on native",
      "Graceful fallback on web"
    ]
  },
  {
    "subject": "Configure Deep Linking for OAuth",
    "description": "Update app.json with scheme: 'worktracker'. Create src/lib/linking.ts with linking configuration for React Navigation: prefixes: ['worktracker://', 'https://worktracker.app'], config mapping routes. Handle OAuth PKCE callback flow correctly: The callback URL (worktracker://auth/callback) receives an authorization code, NOT tokens directly. Use Supabase's exchangeCodeForSession() to securely exchange the code for tokens. NEVER pass tokens in callback URLs. Create src/hooks/useDeepLink.ts to handle incoming links: parse the URL, extract the code parameter, call supabase.auth.exchangeCodeForSession(code), then route to main app on success. Update Supabase client to use correct redirect URL based on platform: web uses window.location.origin + '/auth/callback', native uses 'worktracker://auth/callback'. Document required setup for iOS (Associated Domains) and Android (intent-filter) in docs/DEEP_LINKING.md.",
    "depends_on_subjects": ["Implement Authentication Context and Hooks", "Configure Expo for Multi-Platform Build"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "Validate OAuth callback parameters",
      "Only accept callbacks from configured domains",
      "Use PKCE code exchange, never pass tokens in URLs"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "OAuth callback returns to app on native",
      "OAuth callback works on web",
      "Deep links route to correct screens",
      "Documentation complete"
    ]
  },
  {
    "subject": "Add App Icons and Splash Screens",
    "description": "Create assets/ directory. Design and create assets/icon.png (1024x1024, app icon). Create assets/adaptive-icon.png (1024x1024, Android adaptive icon foreground). Create assets/splash.png (1284x2778, splash screen matching dark theme background). Update app.json with icon, splash, and android.adaptiveIcon paths. Use expo-splash-screen to control splash visibility until app is ready (auth check complete, initial data loaded). Create favicon.ico for web. Test icons display correctly on all platforms. Include design source files or instructions in assets/README.md.",
    "depends_on_subjects": ["Configure Expo for Multi-Platform Build"],
    "estimated_complexity": "small",
    "task_type": "frontend_ui",
    "security_requirements": [],
    "performance_requirements": [
      "Splash screen should hide quickly after app ready"
    ],
    "acceptance_criteria": [
      "Icons display correctly on iOS",
      "Icons display correctly on Android",
      "Splash screen matches app theme",
      "Favicon works on web"
    ]
  },
  {
    "subject": "Create Production Dockerfile",
    "description": "Create Dockerfile with multi-stage build: Stage 1 (builder): FROM node:20-alpine, WORKDIR /app, COPY package*.json, RUN npm ci, COPY ., RUN npm run build:web. Stage 2 (production): FROM nginx:alpine, COPY --from=builder /app/dist /usr/share/nginx/html, COPY nginx/nginx.conf /etc/nginx/nginx.conf, EXPOSE 80, CMD [nginx, -g, daemon off;]. Create .dockerignore excluding node_modules, .git, .env, etc. Configure for arm64 build: use --platform linux/arm64 or multi-arch buildx. Test build locally with docker build -t worktracker . and docker run -p 3000:80 worktracker.",
    "depends_on_subjects": ["Initialize Expo Project with TypeScript"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "Run nginx as non-root user",
      "No secrets in image layers",
      "Use specific version tags, not :latest"
    ],
    "performance_requirements": [
      "Multi-stage build for smaller image",
      "Use alpine base for minimal size"
    ],
    "acceptance_criteria": [
      "Docker build succeeds for arm64",
      "Container runs and serves app",
      "Image size < 100MB",
      "No sensitive data in image"
    ]
  },
  {
    "subject": "Create Docker Compose Configuration",
    "description": "Create docker-compose.yml for local development: services: web (builds from Dockerfile, ports: 3000:80, environment variables from .env). Create docker-compose.prod.yml for production: web service with restart: unless-stopped, logging configuration, health check (curl localhost:80/health). Add optional Supabase local development stack (supabase/supabase image) for offline development. Create .env.example with all required variables. Add volume for nginx logs. Document usage in docs/DOCKER.md including: docker-compose up -d, viewing logs, rebuilding after changes.",
    "depends_on_subjects": ["Create Production Dockerfile"],
    "estimated_complexity": "small",
    "task_type": "infrastructure",
    "security_requirements": [
      "Production compose should not expose unnecessary ports",
      "Secrets via environment variables, not in compose file"
    ],
    "performance_requirements": [
      "Add health check for container monitoring"
    ],
    "acceptance_criteria": [
      "docker-compose up starts application",
      "Production compose includes health checks",
      "Logging configured",
      "Documentation complete"
    ]
  },
  {
    "subject": "Configure Nginx Reverse Proxy",
    "description": "Create nginx/nginx.conf with: worker_processes auto, events { worker_connections 1024 }, http { include mime.types, sendfile on, gzip on (gzip_types for js/css/json), server { listen 80, server_name _, location /health { access_log off; return 200 'OK'; add_header Content-Type text/plain; }, location / { root /usr/share/nginx/html, try_files $uri $uri/ /index.html } } }. IMPORTANT: The /health endpoint is REQUIRED for Docker health checks in docker-compose.prod.yml. Create nginx/security-headers.conf with: X-Content-Type-Options nosniff, X-Frame-Options DENY, X-XSS-Protection 1;mode=block, Referrer-Policy strict-origin-when-cross-origin, Content-Security-Policy (allow Supabase domain, Google OAuth). Create nginx/ssl.conf template for HTTPS configuration. Disable server_tokens. Configure caching headers for static assets (1 year for hashed files, no-cache for index.html).",
    "depends_on_subjects": ["Create Production Dockerfile"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "Security headers must be set",
      "CSP must be configured for OAuth domains",
      "Disable server version disclosure"
    ],
    "performance_requirements": [
      "Enable gzip compression",
      "Configure aggressive caching for static assets",
      "Enable sendfile for performance"
    ],
    "acceptance_criteria": [
      "Security headers present in responses",
      "Gzip compression working",
      "SPA routing works (try_files)",
      "Static assets cached",
      "/health endpoint returns 200 OK for Docker health checks"
    ]
  },
  {
    "subject": "Create SSL Certificate Setup",
    "description": "Create scripts/setup-ssl.sh for Let's Encrypt: install certbot, run certbot certonly --webroot -w /var/www/certbot -d yourdomain.com, configure auto-renewal cron job. Create scripts/setup-ssl-selfsigned.sh for development: generate self-signed cert with openssl (365 day validity), save to certs/ directory. Update nginx/ssl.conf with SSL configuration: listen 443 ssl, ssl_certificate/ssl_certificate_key paths, ssl_protocols TLSv1.2 TLSv1.3, ssl_ciphers (modern config from Mozilla SSL Config Generator), ssl_prefer_server_ciphers on. Add redirect from HTTP to HTTPS. Create docs/SSL_SETUP.md with step-by-step instructions for both options.",
    "depends_on_subjects": ["Configure Nginx Reverse Proxy"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "TLS 1.2 minimum",
      "Strong cipher suite",
      "HSTS header when using SSL",
      "Auto-renewal for Let's Encrypt"
    ],
    "performance_requirements": [
      "Enable OCSP stapling",
      "Configure SSL session cache"
    ],
    "acceptance_criteria": [
      "Let's Encrypt script works",
      "Self-signed script works",
      "HTTPS serves correctly",
      "HTTP redirects to HTTPS",
      "SSL Labs score A or better"
    ]
  },
  {
    "subject": "Create Raspberry Pi Deployment Guide",
    "description": "Create docs/RASPBERRY_PI_DEPLOYMENT.md with complete instructions: 1) Flash Raspberry Pi OS 64-bit, 2) Initial setup (SSH, updates, hostname), 3) Install Docker (curl -fsSL get.docker.com | sh), 4) Install docker-compose, 5) Configure UFW firewall (allow 22, 80, 443), 6) Clone repository, 7) Configure environment variables, 8) Build and start containers. Create scripts/deploy.sh automating: git pull, docker-compose build, docker-compose up -d. Create scripts/systemd/worktracker.service for auto-start on boot. Include troubleshooting section. Add performance tuning for Pi (swap, memory limits). Document backup strategy for data.",
    "depends_on_subjects": ["Create Production Dockerfile", "Create Docker Compose Configuration", "Configure Nginx Reverse Proxy", "Create SSL Certificate Setup"],
    "estimated_complexity": "large",
    "task_type": "infrastructure",
    "security_requirements": [
      "UFW firewall rules documented",
      "SSH hardening recommendations",
      "No default passwords"
    ],
    "performance_requirements": [
      "Memory limits for containers suitable for Pi",
      "Swap configuration for low-memory situations"
    ],
    "acceptance_criteria": [
      "Fresh Pi deployment succeeds following guide",
      "App accessible after boot",
      "Firewall blocks unnecessary ports",
      "Systemd service works"
    ]
  },
  {
    "subject": "Write Unit Tests for Business Logic",
    "description": "Install jest, @types/jest, ts-jest. Create jest.config.js configured for TypeScript. Create src/__tests__/services/timerService.test.ts testing: startTimer creates correct record, stopTimer calculates duration correctly, elapsed time calculation handles timezones. Create src/__tests__/stores/timerStore.test.ts testing: all state transitions, persistence, queue operations. Create src/__tests__/utils/analytics.test.ts testing: date range calculations, week boundary calculations with different week start days, timezone conversions. Create src/__tests__/schemas/ testing all Zod schemas with valid and invalid inputs, specifically verifying Create/Update schemas reject server-managed fields. Mock Supabase client for isolated testing. Aim for >80% coverage on business logic modules.",
    "depends_on_subjects": ["Implement Timer Zustand Store", "Create Timer Service with Supabase Integration", "Create Analytics Query Hooks"],
    "estimated_complexity": "large",
    "task_type": "testing",
    "security_requirements": [
      "Test that Zod schemas reject invalid inputs",
      "Test that Create/Update schemas reject id, user_id, and timestamp fields"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      ">80% coverage on business logic",
      "All timer state transitions tested",
      "All Zod schemas have validation tests",
      "Analytics calculations verified",
      "Schema tests verify Create/Update schemas exclude server-managed fields"
    ]
  },
  {
    "subject": "Write Integration Tests for Supabase RLS",
    "description": "Create supabase/tests/ directory. Create supabase/tests/rls_categories.test.sql testing: user can read own categories, user cannot read other user's categories, user cannot insert with different user_id, user cannot update other user's category, verify user_id is auto-set via auth.uid(). Create similar test files for time_entries, active_timers, monthly_goals. Create src/__tests__/integration/auth.test.ts testing OAuth flow with test Supabase instance. Create src/__tests__/integration/timer.test.ts testing real timer operations against Supabase. Use Supabase CLI for local testing (supabase start). Create scripts/test-integration.sh to spin up local Supabase, run tests, tear down.",
    "depends_on_subjects": ["Create Supabase Database Migrations", "Implement Row Level Security Policies", "Create Database Functions and Triggers"],
    "estimated_complexity": "large",
    "task_type": "testing",
    "security_requirements": [
      "Every RLS policy must have a test",
      "Test cross-user access is blocked",
      "Test unauthenticated access is blocked",
      "Test that user_id cannot be set by client"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "All RLS policies have tests",
      "Cross-user access blocked in tests",
      "Unauthenticated access blocked",
      "Integration tests run in CI",
      "Tests verify user_id is server-derived"
    ]
  },
  {
    "subject": "Write Component Tests",
    "description": "Install @testing-library/react-native, @testing-library/jest-native. Create src/__tests__/components/TimerDisplay.test.tsx testing: renders elapsed time correctly, updates on interval, handles zero state. Create tests for TimerControls (button states, click handlers), CategorySelector (renders categories with name/color/type, selection works), EntryCard (displays data correctly including category type), HistoryFilters (filter changes propagate), CategoryForm (validates all three fields: name, color, type). Create src/__tests__/screens/TimerScreen.test.tsx testing full screen render with mocked hooks. Use jest.mock for Supabase client and navigation. Test accessibility: labels present, roles correct.",
    "depends_on_subjects": ["Build Timer Screen", "Build History Screen", "Build Analytics Dashboard Screen", "Build Category Management Screen"],
    "estimated_complexity": "medium",
    "task_type": "testing",
    "security_requirements": [],
    "performance_requirements": [],
    "acceptance_criteria": [
      "Key components have tests",
      "User interactions tested",
      "Accessibility attributes verified",
      "Mocking strategy documented",
      "CategoryForm tests verify name, color, AND type field validation"
    ]
  },
  {
    "subject": "Configure CI CD Pipeline",
    "description": "Create .github/workflows/ci.yml running on push/PR: checkout, setup-node, npm ci, npm run lint, npm run typecheck (tsc --noEmit), npm run test (unit tests). Add job for integration tests: setup Supabase CLI, supabase start, run integration tests, supabase stop. Create .github/workflows/build.yml for build verification: build web, build Electron (macOS), verify Docker build. Create .github/workflows/deploy.yml (manual trigger) for deployment to Raspberry Pi: SSH to Pi, run deploy script. Document required GitHub secrets: SUPABASE_URL, SUPABASE_ANON_KEY, PI_SSH_KEY. Add status badges to README.",
    "depends_on_subjects": ["Write Unit Tests for Business Logic", "Write Integration Tests for Supabase RLS", "Write Component Tests"],
    "estimated_complexity": "medium",
    "task_type": "infrastructure",
    "security_requirements": [
      "Secrets stored in GitHub Secrets",
      "No secrets logged in CI output",
      "SSH key for deployment stored securely"
    ],
    "performance_requirements": [
      "CI should complete in < 10 minutes"
    ],
    "acceptance_criteria": [
      "CI runs on every PR",
      "All checks must pass to merge",
      "Integration tests run in CI",
      "Manual deploy trigger works"
    ]
  },
  {
    "subject": "Create User Documentation",
    "description": "Create README.md with: project description, features list, tech stack, quick start instructions, screenshots, links to detailed docs. Create docs/USER_GUIDE.md explaining: how to use timer, managing categories (with name, color, AND type fields explained), viewing history, understanding analytics, setting goals, configuring settings. Create docs/DEVELOPER_GUIDE.md with: architecture overview, local setup, coding standards, testing approach, PR process, explanation of Create/Update schema pattern for mutations. Create docs/API.md documenting Supabase schema and any RPC functions. Create docs/DEPLOYMENT_CHECKLIST.md with pre-deployment verification steps. Add inline code comments for complex logic. Ensure all existing docs are complete and accurate.",
    "depends_on_subjects": ["Build Timer Screen", "Build History Screen", "Build Analytics Dashboard Screen", "Build Settings Screen", "Build Category Management Screen", "Build Goals Management Screen", "Create Raspberry Pi Deployment Guide", "Configure CI CD Pipeline"],
    "estimated_complexity": "medium",
    "task_type": "general",
    "security_requirements": [
      "Document security considerations for self-hosting"
    ],
    "performance_requirements": [],
    "acceptance_criteria": [
      "README provides clear quick start",
      "User guide covers all features including category type field",
      "Developer guide enables contributions",
      "All links in docs work"
    ]
  }
]
```