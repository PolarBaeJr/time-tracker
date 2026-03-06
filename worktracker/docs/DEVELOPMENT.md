# Development Workflow

## Seed Data

WorkTracker ships with a development seed workflow for local or shared test environments.

- Categories are intentionally left empty. The product requirement is that users create their own categories from scratch.
- Sample time entries are marked with the prefix `[Seed - removable]` so they can be deleted safely after smoke testing.
- Sample monthly goals are overall goals only (`category_id = NULL`) to avoid introducing fake category data.

### Environment

Copy [`.env.example`](../.env.example) to `.env` and set:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in the app bundle or commit it to git.

### Seed Script

The primary workflow is:

```bash
npm run seed:dev
```

What it does:

1. Ensures two dev-only auth users exist:
   - `dev.alice@worktracker.local`
   - `dev.bob@worktracker.local`
2. Upserts matching `public.users` profile rows with stable timezone and week-start defaults.
3. Upserts removable sample `time_entries` and overall `monthly_goals`.

The script is idempotent. Re-running it updates the same fixed sample rows instead of duplicating them.

Useful options:

```bash
npm run seed:dev -- --dry-run
npm run seed:dev -- --skip-users
npm run seed:dev -- --skip-samples
```

- `--dry-run` prints the planned actions without calling Supabase.
- `--skip-users` requires the target auth users to already exist and only syncs profile/sample data.
- `--skip-samples` creates or verifies the dev users without inserting the removable sample rows.

If the script creates a new auth user, it prints a generated password once to the terminal. Treat that password as disposable development-only data.

### Local SQL Seed

[`supabase/seed.sql`](../supabase/seed.sql) is a local SQL fallback for environments where you already have matching auth users and only want the sample data.

The SQL file:

- does not create auth users
- does not seed categories
- upserts the same removable time entries and monthly goals used by the TypeScript script

If you prefer not to use the service role key, create local users manually in Supabase first, then run the SQL seed against your local database.
