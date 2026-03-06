import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SeedOptions {
  dryRun: boolean;
  help: boolean;
  skipSamples: boolean;
  skipUsers: boolean;
}

interface DevSeedUser {
  email: string;
  name: string;
  timezone: string;
  weekStartDay: number;
}

interface SeededUser extends DevSeedUser {
  created: boolean;
  generatedPassword?: string;
  id: string;
}

interface SampleTimeEntry {
  duration_seconds: number;
  end_at: string;
  id: string;
  notes: string;
  start_at: string;
  userEmail: string;
}

interface SampleMonthlyGoal {
  id: string;
  month: string;
  target_hours: number;
  userEmail: string;
}

interface PublicUserRecord {
  email: string;
  id: string;
}

interface SeedDatabase {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      monthly_goals: {
        Insert: {
          category_id?: string | null;
          id?: string;
          month: string;
          target_hours: number;
          user_id: string;
        };
        Relationships: [];
        Row: {
          category_id: string | null;
          id: string;
          month: string;
          target_hours: number;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          id?: string;
          month?: string;
          target_hours?: number;
          user_id?: string;
        };
      };
      time_entries: {
        Insert: {
          category_id?: string | null;
          duration_seconds: number;
          end_at?: string | null;
          id?: string;
          notes?: string | null;
          start_at: string;
          user_id: string;
        };
        Relationships: [];
        Row: {
          category_id: string | null;
          duration_seconds: number;
          end_at: string | null;
          id: string;
          notes: string | null;
          start_at: string;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          duration_seconds?: number;
          end_at?: string | null;
          id?: string;
          notes?: string | null;
          start_at?: string;
          user_id?: string;
        };
      };
      users: {
        Insert: {
          email: string;
          id: string;
          name?: string | null;
          timezone?: string;
          week_start_day?: number;
        };
        Relationships: [];
        Row: {
          email: string;
          id: string;
          name: string | null;
          timezone: string;
          week_start_day: number;
        };
        Update: {
          email?: string;
          id?: string;
          name?: string | null;
          timezone?: string;
          week_start_day?: number;
        };
      };
    };
    Views: Record<string, never>;
  };
}

type SeedSupabaseClient = SupabaseClient<SeedDatabase>;
type MonthlyGoalInsert = SeedDatabase['public']['Tables']['monthly_goals']['Insert'];
type PublicUserInsert = SeedDatabase['public']['Tables']['users']['Insert'];
type TimeEntryInsert = SeedDatabase['public']['Tables']['time_entries']['Insert'];

const DEV_USERS: readonly DevSeedUser[] = [
  {
    email: 'dev.alice@worktracker.local',
    name: 'Dev Alice',
    timezone: 'America/Vancouver',
    weekStartDay: 1,
  },
  {
    email: 'dev.bob@worktracker.local',
    name: 'Dev Bob',
    timezone: 'UTC',
    weekStartDay: 0,
  },
] as const;

const SEED_NOTE_PREFIX = '[Seed - removable]';

function writeStderr(message: string): void {
  process.stderr.write(message.endsWith('\n') ? message : `${message}\n`);
}

function writeStdout(message: string): void {
  process.stdout.write(message.endsWith('\n') ? message : `${message}\n`);
}

function parseOptions(argv: string[]): SeedOptions {
  const options: SeedOptions = {
    dryRun: false,
    help: false,
    skipSamples: false,
    skipUsers: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--skip-samples':
        options.skipSamples = true;
        break;
      case '--skip-users':
        options.skipUsers = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp(): void {
  writeStdout(`Usage: npm run seed:dev -- [options]

Seeds development-only users and sample data into Supabase.

Options:
  --dry-run       Print the planned seed actions without calling Supabase
  --skip-users    Reuse existing auth/public users instead of creating them
  --skip-samples  Skip sample time entries and monthly goals
  --help, -h      Show this help message
`);
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function validateSupabaseUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL');
  }
}

function getMonthStartIso(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function makeUtcDate(daysAgo: number, hours: number, minutes: number): Date {
  const baseDate = new Date();

  return new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate() - daysAgo,
      hours,
      minutes,
      0,
      0
    )
  );
}

function buildSampleTimeEntries(): readonly SampleTimeEntry[] {
  const aliceFocusStart = makeUtcDate(3, 16, 0);
  const aliceFocusEnd = makeUtcDate(3, 18, 30);
  const aliceReviewStart = makeUtcDate(1, 20, 15);
  const aliceReviewEnd = makeUtcDate(1, 21, 0);
  const bobPlanningStart = makeUtcDate(4, 14, 0);
  const bobPlanningEnd = makeUtcDate(4, 15, 45);

  return [
    {
      duration_seconds: 9000,
      end_at: aliceFocusEnd.toISOString(),
      id: '8d0db8bb-5c23-43be-b25f-a3f194d4d001',
      notes: `${SEED_NOTE_PREFIX} Focus block for timer/history testing`,
      start_at: aliceFocusStart.toISOString(),
      userEmail: 'dev.alice@worktracker.local',
    },
    {
      duration_seconds: 2700,
      end_at: aliceReviewEnd.toISOString(),
      id: '8d0db8bb-5c23-43be-b25f-a3f194d4d002',
      notes: `${SEED_NOTE_PREFIX} Short review session`,
      start_at: aliceReviewStart.toISOString(),
      userEmail: 'dev.alice@worktracker.local',
    },
    {
      duration_seconds: 6300,
      end_at: bobPlanningEnd.toISOString(),
      id: '8d0db8bb-5c23-43be-b25f-a3f194d4d003',
      notes: `${SEED_NOTE_PREFIX} Planning session for analytics smoke testing`,
      start_at: bobPlanningStart.toISOString(),
      userEmail: 'dev.bob@worktracker.local',
    },
  ] as const;
}

function buildSampleGoals(): readonly SampleMonthlyGoal[] {
  const month = getMonthStartIso(new Date());

  return [
    {
      id: 'c44d675a-a61e-4f3f-9d36-d6bc93394001',
      month,
      target_hours: 40,
      userEmail: 'dev.alice@worktracker.local',
    },
    {
      id: 'c44d675a-a61e-4f3f-9d36-d6bc93394002',
      month,
      target_hours: 12.5,
      userEmail: 'dev.bob@worktracker.local',
    },
  ] as const;
}

async function loadExistingUsers(
  supabase: SeedSupabaseClient,
  emails: readonly string[]
): Promise<Map<string, PublicUserRecord>> {
  const allUsersByEmail = new Map<string, PublicUserRecord>();
  let page = 1;

  while (allUsersByEmail.size < emails.length) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    for (const user of data.users) {
      const email = user.email?.toLowerCase();

      if (email && emails.includes(email)) {
        allUsersByEmail.set(email, {
          email,
          id: user.id,
        });
      }
    }

    if (!data.nextPage || data.users.length === 0) {
      break;
    }

    page = data.nextPage;
  }

  return allUsersByEmail;
}

function generatePassword(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure random UUID generation is not available in this Node runtime');
  }

  return `WorkTracker-${globalThis.crypto.randomUUID()}`;
}

async function ensureUsers(
  supabase: SeedSupabaseClient,
  options: SeedOptions
): Promise<SeededUser[]> {
  const existingUsers = await loadExistingUsers(
    supabase,
    DEV_USERS.map((user) => user.email)
  );
  const seededUsers: SeededUser[] = [];

  for (const user of DEV_USERS) {
    const existing = existingUsers.get(user.email);

    if (existing) {
      seededUsers.push({
        ...user,
        created: false,
        id: existing.id,
      });
      continue;
    }

    if (options.skipUsers) {
      throw new Error(
        `Missing auth user for ${user.email}. Remove --skip-users or create the user manually first.`
      );
    }

    const password = generatePassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      password,
      user_metadata: {
        name: user.name,
      },
    });

    if (error || !data.user) {
      throw new Error(`Unable to create auth user ${user.email}: ${error?.message ?? 'unknown error'}`);
    }

    seededUsers.push({
      ...user,
      created: true,
      generatedPassword: password,
      id: data.user.id,
    });
  }

  return seededUsers;
}

async function upsertPublicProfiles(
  supabase: SeedSupabaseClient,
  users: readonly SeededUser[]
): Promise<void> {
  const rows: PublicUserInsert[] = users.map((user) => ({
    email: user.email,
    id: user.id,
    name: user.name,
    timezone: user.timezone,
    week_start_day: user.weekStartDay,
  }));
  const { error } = await supabase.from('users').upsert(rows, {
    onConflict: 'id',
  });

  if (error) {
    throw new Error(`Unable to upsert public user profiles: ${error.message}`);
  }
}

async function upsertSampleData(
  supabase: SeedSupabaseClient,
  users: readonly SeededUser[]
): Promise<{ goals: number; timeEntries: number }> {
  const userIdByEmail = new Map(users.map((user) => [user.email, user.id]));
  const sampleEntries: TimeEntryInsert[] = buildSampleTimeEntries().map((entry) => {
    const userId = userIdByEmail.get(entry.userEmail);

    if (!userId) {
      throw new Error(`Cannot seed time entry ${entry.id} because ${entry.userEmail} is unavailable`);
    }

    return {
      category_id: null,
      duration_seconds: entry.duration_seconds,
      end_at: entry.end_at,
      id: entry.id,
      notes: entry.notes,
      start_at: entry.start_at,
      user_id: userId,
    };
  });
  const sampleGoals: MonthlyGoalInsert[] = buildSampleGoals().map((goal) => {
    const userId = userIdByEmail.get(goal.userEmail);

    if (!userId) {
      throw new Error(`Cannot seed monthly goal ${goal.id} because ${goal.userEmail} is unavailable`);
    }

    return {
      category_id: null,
      id: goal.id,
      month: goal.month,
      target_hours: goal.target_hours,
      user_id: userId,
    };
  });

  const { error: timeEntriesError } = await supabase.from('time_entries').upsert(sampleEntries, {
    onConflict: 'id',
  });

  if (timeEntriesError) {
    throw new Error(`Unable to upsert sample time entries: ${timeEntriesError.message}`);
  }

  const { error: goalsError } = await supabase.from('monthly_goals').upsert(sampleGoals, {
    onConflict: 'id',
  });

  if (goalsError) {
    throw new Error(`Unable to upsert sample monthly goals: ${goalsError.message}`);
  }

  return {
    goals: sampleGoals.length,
    timeEntries: sampleEntries.length,
  };
}

function printDryRunSummary(options: SeedOptions): void {
  const plannedEntries = options.skipSamples ? 0 : buildSampleTimeEntries().length;
  const plannedGoals = options.skipSamples ? 0 : buildSampleGoals().length;

  writeStdout('[seed:dev] Dry run only. No Supabase calls were made.');
  writeStdout(`[seed:dev] Users to ensure: ${DEV_USERS.length}`);
  writeStdout(`[seed:dev] Sample time entries to upsert: ${plannedEntries}`);
  writeStdout(`[seed:dev] Sample monthly goals to upsert: ${plannedGoals}`);
  writeStdout('[seed:dev] Categories intentionally remain empty.');
}

function printRunSummary(
  users: readonly SeededUser[],
  sampleCounts: { goals: number; timeEntries: number }
): void {
  writeStdout('[seed:dev] Development seed complete.');

  for (const user of users) {
    const status = user.created ? 'created' : 'existing';
    writeStdout(`[seed:dev] ${status}: ${user.email} (${user.id})`);

    if (user.generatedPassword) {
      writeStdout(
        `[seed:dev] password for ${user.email}: ${user.generatedPassword} (shown once; rotate or delete after use)`
      );
    }
  }

  writeStdout(`[seed:dev] Sample time entries upserted: ${sampleCounts.timeEntries}`);
  writeStdout(`[seed:dev] Sample monthly goals upserted: ${sampleCounts.goals}`);
  writeStdout('[seed:dev] Categories were not seeded by design.');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.dryRun) {
    printDryRunSummary(options);
    return;
  }

  const supabaseUrl = getRequiredEnvVar('SUPABASE_URL');
  const serviceRoleKey = getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  validateSupabaseUrl(supabaseUrl);

  const supabase = createClient<SeedDatabase>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const users = await ensureUsers(supabase, options);

  await upsertPublicProfiles(supabase, users);

  let sampleCounts = { goals: 0, timeEntries: 0 };

  if (!options.skipSamples) {
    sampleCounts = await upsertSampleData(supabase, users);
  }

  printRunSummary(users, sampleCounts);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected seed failure';
  writeStderr(`[seed:dev] ${message}`);
  process.exitCode = 1;
});
