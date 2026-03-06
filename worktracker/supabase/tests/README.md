# Supabase RLS Integration Tests

This directory contains SQL-based integration tests that verify Row Level Security (RLS) policies work correctly in the WorkTracker database.

## Test Files

| File | Description |
|------|-------------|
| `rls_categories.test.sql` | Tests RLS policies for the `categories` table |
| `rls_time_entries.test.sql` | Tests RLS policies for the `time_entries` table |
| `rls_active_timers.test.sql` | Tests RLS policies for the `active_timers` table |
| `rls_monthly_goals.test.sql` | Tests RLS policies for the `monthly_goals` table |

## What the Tests Verify

Each test file verifies the following security properties:

1. **User can read their own data** - SELECT operations work for rows owned by the authenticated user
2. **User cannot read other users' data** - SELECT operations return empty for other users' rows
3. **User cannot insert with different user_id** - INSERT operations with a mismatched user_id are blocked
4. **User cannot update other users' data** - UPDATE operations on other users' rows have no effect
5. **User cannot delete other users' data** - DELETE operations on other users' rows have no effect
6. **user_id is auto-set via auth.uid()** - Inserting without user_id uses the authenticated user's ID

### Additional Tests

- **active_timers**: Verifies UNIQUE constraint (one timer per user) and auto-set started_at
- **monthly_goals**: Verifies partial unique indexes for overall vs per-category goals, and tests the `set_monthly_goal` RPC function

## Running Tests

### Prerequisites

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed
2. Docker running

### Quick Start

```bash
# From the worktracker directory
./scripts/test-integration.sh
```

### Options

```bash
# Skip starting Supabase (if already running)
./scripts/test-integration.sh --skip-start

# Keep test data after tests complete
./scripts/test-integration.sh --no-cleanup

# Show verbose output
./scripts/test-integration.sh --verbose
```

### Manual Execution

If you prefer to run tests manually:

```bash
# Start Supabase
supabase start

# Get the database URL
supabase status

# Run individual test files
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls_categories.test.sql
```

## Test Structure

Each test file follows this pattern:

```sql
-- Setup: Create test users (Alice and Bob)
DO $$ BEGIN
    -- Create auth.users and public.users records
END $$;

-- Test 1: Verify expected behavior
DO $$ BEGIN
    -- Set auth context to simulate user
    PERFORM set_config('request.jwt.claim.sub', user_id::text, true);

    -- Test and verify
    IF condition THEN
        RAISE EXCEPTION 'TEST FAILED: ...';
    END IF;
    RAISE NOTICE 'TEST PASSED: ...';
END $$;

-- Cleanup: Remove test data
DO $$ BEGIN
    DELETE FROM ... WHERE user_id IN (alice_id, bob_id);
END $$;
```

## Test Users

Tests use fixed UUIDs for reproducibility:

| User | UUID |
|------|------|
| Alice | `11111111-1111-1111-1111-111111111111` |
| Bob | `22222222-2222-2222-2222-222222222222` |

## Troubleshooting

### Tests fail with "auth.uid() returns NULL"

The local Supabase environment may not properly simulate authenticated users. Ensure you're using `set_config('request.jwt.claim.sub', ...)` before operations.

### "Role does not exist" errors

The test may need to run as the `postgres` superuser to bypass RLS for setup/cleanup. Use `SET LOCAL ROLE postgres;` in those sections.

### Docker containers not starting

```bash
# Reset local Supabase
supabase stop
supabase start
```

## Security Notes

These tests verify the core tenant isolation model:

- Each user can only access their own data
- user_id is always derived from `auth.uid()` (server-side)
- RLS policies prevent cross-tenant data access
- Realtime subscriptions also respect RLS

**Known Limitations (see Security Sentinel findings):**

- Category ownership is not verified for category_id references (cross-tenant category_id injection possible)
- active_timers.started_at can be modified by UPDATE (duration falsification possible)
- public.users.email is not actually immutable despite policy comments

These issues should be addressed in future migrations before production deployment.
