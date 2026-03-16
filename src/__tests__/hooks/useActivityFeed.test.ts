/**
 * Activity Feed Hooks Tests
 *
 * Tests for the activity feed React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - ActivityFeedFetchError class
 * - Query key generation
 * - fetchActivityFeed pagination
 * - Event type filtering
 *
 * Note: Full hook integration tests require renderHook from @testing-library/react-hooks
 */

// Mock dependencies BEFORE importing the module under test
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    activityFeed: (workspaceId: string) => ['activityFeed', workspaceId] as const,
  },
}));

jest.mock('@/lib/activityFeedRealtime', () => ({
  createActivityFeedSubscription: jest.fn(),
}));

// Now import the module under test
import {
  ActivityFeedFetchError,
  fetchActivityFeed,
  fetchLatestActivityEvents,
} from '@/hooks/useActivityFeed';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Activity Feed Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should generate correct activityFeed key with workspace id', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.activityFeed(workspaceId)).toEqual(['activityFeed', workspaceId]);
    });

    it('should generate unique keys for different workspace ids', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = queryKeys.activityFeed(id1);
      const key2 = queryKeys.activityFeed(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[1]).not.toEqual(key2[1]); // Different IDs
    });
  });

  // ============================================================================
  // ActivityFeedFetchError Tests
  // ============================================================================

  describe('ActivityFeedFetchError', () => {
    it('should create error with message', () => {
      const error = new ActivityFeedFetchError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('ActivityFeedFetchError');
    });

    it('should create error with message and code', () => {
      const error = new ActivityFeedFetchError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'event_type', reason: 'invalid' };
      const error = new ActivityFeedFetchError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new ActivityFeedFetchError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ActivityFeedFetchError);
    });

    it('should have undefined code when not provided', () => {
      const error = new ActivityFeedFetchError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new ActivityFeedFetchError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new ActivityFeedFetchError('Test');
      expect(error.name).toBe('ActivityFeedFetchError');
      expect(error.stack).toContain('ActivityFeedFetchError');
    });
  });

  // ============================================================================
  // fetchActivityFeed Tests
  // ============================================================================

  describe('fetchActivityFeed', () => {
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockEvents = [
      {
        id: '123e4567-e89b-12d3-a456-426614174010',
        workspace_id: mockWorkspaceId,
        actor_user_id: '123e4567-e89b-12d3-a456-426614174001',
        event_type: 'entry_logged',
        payload: { duration: 3600 },
        created_at: '2024-03-01T12:00:00.000Z',
        actor: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          email: 'user@example.com',
          name: 'Test User',
        },
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174011',
        workspace_id: mockWorkspaceId,
        actor_user_id: '123e4567-e89b-12d3-a456-426614174002',
        event_type: 'entry_approved',
        payload: { entry_id: '123' },
        created_at: '2024-03-01T11:00:00.000Z',
        actor: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      },
    ];

    function setupMock(data: unknown[] | null = mockEvents, error: unknown = null, extra = 0) {
      // Add extra items to simulate "more pages"
      const returnData = data ? [...data, ...Array(extra).fill(data[0])] : null;

      const mockLimit = jest.fn().mockResolvedValue({ data: returnData, error });
      const mockLte = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockGte = jest.fn().mockReturnValue({ lte: mockLte, limit: mockLimit });
      const mockActorEq = jest
        .fn()
        .mockReturnValue({ gte: mockGte, lte: mockLte, limit: mockLimit });
      const mockIn = jest
        .fn()
        .mockReturnValue({ eq: mockActorEq, gte: mockGte, lte: mockLte, limit: mockLimit });
      const mockLt = jest
        .fn()
        .mockReturnValue({
          in: mockIn,
          eq: mockActorEq,
          gte: mockGte,
          lte: mockLte,
          limit: mockLimit,
        });
      const mockOrder = jest
        .fn()
        .mockReturnValue({
          lt: mockLt,
          in: mockIn,
          eq: mockActorEq,
          gte: mockGte,
          lte: mockLte,
          limit: mockLimit,
        });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      return { mockLimit, mockIn, mockLt, mockActorEq, mockGte, mockLte };
    }

    it('should fetch activity feed events', async () => {
      setupMock();

      const result = await fetchActivityFeed(mockWorkspaceId);

      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174010',
        event_type: 'entry_logged',
        actor: {
          email: 'user@example.com',
          name: 'Test User',
        },
      });
      expect(supabase.from).toHaveBeenCalledWith('activity_feed');
    });

    it('should return empty page when no data is returned', async () => {
      setupMock(null);

      const result = await fetchActivityFeed(mockWorkspaceId);

      expect(result).toEqual({
        events: [],
        next_cursor: null,
        has_more: false,
      });
    });

    it('should throw ActivityFeedFetchError on supabase error', async () => {
      setupMock(null, { message: 'DB Error', code: 'PGRST001' });

      await expect(fetchActivityFeed(mockWorkspaceId)).rejects.toThrow(ActivityFeedFetchError);
      await expect(fetchActivityFeed(mockWorkspaceId)).rejects.toThrow('DB Error');
    });

    it('should handle pagination with cursor', async () => {
      const mocks = setupMock();

      await fetchActivityFeed(mockWorkspaceId, { cursor: '2024-03-01T10:00:00.000Z' });

      // Should call lt with the cursor
      expect(mocks.mockLt).toHaveBeenCalledWith('created_at', '2024-03-01T10:00:00.000Z');
    });

    it('should apply event type filter', async () => {
      const mocks = setupMock();

      await fetchActivityFeed(mockWorkspaceId, { eventTypes: ['entry_logged', 'entry_approved'] });

      // Should call in with the event types
      expect(mocks.mockIn).toHaveBeenCalledWith('event_type', ['entry_logged', 'entry_approved']);
    });

    it('should indicate has_more when more events exist', async () => {
      // Return 21 items when pageSize is 20 (default)
      setupMock(mockEvents, null, 19);

      const result = await fetchActivityFeed(mockWorkspaceId);

      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBeDefined();
    });

    it('should indicate no more pages when all events returned', async () => {
      setupMock(mockEvents);

      const result = await fetchActivityFeed(mockWorkspaceId);

      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });

    it('should apply actor filter', async () => {
      const mocks = setupMock();
      const actorId = '123e4567-e89b-12d3-a456-426614174001';

      await fetchActivityFeed(mockWorkspaceId, { actorId });

      expect(mocks.mockActorEq).toHaveBeenCalledWith('actor_user_id', actorId);
    });

    it('should apply time range filters', async () => {
      const mocks = setupMock();

      await fetchActivityFeed(mockWorkspaceId, {
        since: '2024-03-01T00:00:00.000Z',
        until: '2024-03-31T23:59:59.999Z',
      });

      expect(mocks.mockGte).toHaveBeenCalledWith('created_at', '2024-03-01T00:00:00.000Z');
      expect(mocks.mockLte).toHaveBeenCalledWith('created_at', '2024-03-31T23:59:59.999Z');
    });

    it('should respect custom page size', async () => {
      const mocks = setupMock();

      await fetchActivityFeed(mockWorkspaceId, { pageSize: 10 });

      // Should request pageSize + 1 to check for more pages
      expect(mocks.mockLimit).toHaveBeenCalledWith(11);
    });
  });

  // ============================================================================
  // fetchLatestActivityEvents Tests
  // ============================================================================

  describe('fetchLatestActivityEvents', () => {
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockEvents = [
      {
        id: '123e4567-e89b-12d3-a456-426614174010',
        workspace_id: mockWorkspaceId,
        actor_user_id: '123e4567-e89b-12d3-a456-426614174001',
        event_type: 'entry_logged',
        payload: {},
        created_at: '2024-03-01T12:00:00.000Z',
        actor: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          email: 'user@example.com',
          name: 'Test User',
        },
      },
    ];

    function setupMock() {
      const mockLimit = jest.fn().mockResolvedValue({ data: mockEvents, error: null });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      return { mockLimit };
    }

    it('should fetch latest activity events with default count', async () => {
      const mocks = setupMock();

      const result = await fetchLatestActivityEvents(mockWorkspaceId);

      expect(result).toHaveLength(1);
      // Default count is 5, but we only have 1 event so expect 6 (5 + 1 for pagination check)
      expect(mocks.mockLimit).toHaveBeenCalledWith(6);
    });

    it('should fetch latest activity events with custom count', async () => {
      const mocks = setupMock();

      await fetchLatestActivityEvents(mockWorkspaceId, 10);

      expect(mocks.mockLimit).toHaveBeenCalledWith(11);
    });

    it('should return events from the page result', async () => {
      setupMock();

      const result = await fetchLatestActivityEvents(mockWorkspaceId);

      expect(result[0]).toMatchObject({
        event_type: 'entry_logged',
        actor: {
          email: 'user@example.com',
        },
      });
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('ActivityFeedFetchError should have proper properties', () => {
      const error = new ActivityFeedFetchError('Test', 'CODE', { detail: 'value' });

      // These should be properly typed
      const message: string = error.message;
      const code: string | undefined = error.code;
      const details: unknown = error.details;

      expect(message).toBe('Test');
      expect(code).toBe('CODE');
      expect(details).toEqual({ detail: 'value' });
    });
  });
});
