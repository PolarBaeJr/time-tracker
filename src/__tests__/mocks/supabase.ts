/**
 * Mock Supabase Client for Testing
 *
 * This module provides mock implementations of the Supabase client for isolated testing.
 * Use these mocks to test services and hooks without actual network calls.
 *
 * Usage:
 * ```typescript
 * import { createMockSupabase, mockActiveTimer, mockTimeEntry } from '../mocks/supabase';
 *
 * jest.mock('@/lib/supabase', () => ({
 *   supabase: createMockSupabase(),
 * }));
 * ```
 */

import type { ActiveTimer, TimeEntry, Category, MonthlyGoal, User } from '@/types';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

/**
 * Create a mock User
 */
export function mockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123-uuid',
    email: 'test@example.com',
    name: 'Test User',
    timezone: 'UTC',
    week_start_day: 1,
    onboarding_complete: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Create a mock ActiveTimer
 */
export function mockActiveTimer(overrides?: Partial<ActiveTimer>): ActiveTimer {
  return {
    id: 'timer-123-uuid',
    user_id: 'user-123-uuid',
    category_id: null,
    started_at: '2024-03-01T10:00:00.000Z',
    running: true,
    timer_mode: 'normal',
    pomodoro_phase: 'work',
    phase_duration_seconds: null,
    pomodoros_completed: 0,
    ...overrides,
  };
}

/**
 * Create a mock TimeEntry
 */
export function mockTimeEntry(overrides?: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'entry-123-uuid',
    user_id: 'user-123-uuid',
    category_id: null,
    start_at: '2024-03-01T10:00:00.000Z',
    end_at: '2024-03-01T11:30:00.000Z',
    duration_seconds: 5400,
    notes: null,
    entry_type: 'work',
    created_at: '2024-03-01T11:30:00.000Z',
    updated_at: '2024-03-01T11:30:00.000Z',
    ...overrides,
  };
}

/**
 * Create a mock Category
 */
export function mockCategory(overrides?: Partial<Category>): Category {
  return {
    id: 'category-123-uuid',
    user_id: 'user-123-uuid',
    name: 'Work',
    color: '#6366F1',
    type: 'work',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Create a mock MonthlyGoal
 */
export function mockMonthlyGoal(overrides?: Partial<MonthlyGoal>): MonthlyGoal {
  return {
    id: 'goal-123-uuid',
    user_id: 'user-123-uuid',
    month: '2024-03-01',
    category_id: null,
    target_hours: 40,
    ...overrides,
  };
}

// ============================================================================
// MOCK SUPABASE CLIENT
// ============================================================================

type QueryResponse<T> = {
  data: T | null;
  error: { message: string; code: string } | null;
};

interface MockQueryBuilder<T> {
  select: jest.Mock<MockQueryBuilder<T>>;
  insert: jest.Mock<MockQueryBuilder<T>>;
  update: jest.Mock<MockQueryBuilder<T>>;
  delete: jest.Mock<MockQueryBuilder<T>>;
  eq: jest.Mock<MockQueryBuilder<T>>;
  neq: jest.Mock<MockQueryBuilder<T>>;
  gt: jest.Mock<MockQueryBuilder<T>>;
  gte: jest.Mock<MockQueryBuilder<T>>;
  lt: jest.Mock<MockQueryBuilder<T>>;
  lte: jest.Mock<MockQueryBuilder<T>>;
  order: jest.Mock<MockQueryBuilder<T>>;
  limit: jest.Mock<MockQueryBuilder<T>>;
  single: jest.Mock<Promise<QueryResponse<T>>>;
  maybeSingle: jest.Mock<Promise<QueryResponse<T | null>>>;
  then: jest.Mock;
}

/**
 * Create a mock query builder with chainable methods
 */
export function createMockQueryBuilder<T>(defaultResponse: QueryResponse<T>): MockQueryBuilder<T> {
  const builder: MockQueryBuilder<T> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(defaultResponse),
    maybeSingle: jest.fn().mockResolvedValue(defaultResponse),
    then: jest.fn().mockResolvedValue(defaultResponse),
  };

  return builder;
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabase() {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  return {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithOAuth: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue('ok'),
      unsubscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
    // Helper methods for test configuration
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
}

// ============================================================================
// MOCK STORAGE
// ============================================================================

/**
 * Create a mock storage implementation for testing
 */
export function createMockStorage() {
  const store: Map<string, string> = new Map();

  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
    __store: store,
  };
}
