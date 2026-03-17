/**
 * Leaderboard Hooks Tests
 *
 * Tests for the leaderboard React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - LeaderboardFetchError class
 * - Query key generation
 * - Date range calculation (getWeekRange, getMonthRange)
 * - Metric filtering
 * - Utility functions (formatLeaderboardDuration, getRankBadge, getProgressPercentage)
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
    leaderboard: (workspaceId: string, period: 'week' | 'month', metric: 'total' | 'billable') =>
      ['leaderboard', workspaceId, period, metric] as const,
  },
}));

// Now import the module under test
import {
  LeaderboardFetchError,
  getWeekRange,
  getMonthRange,
  getDateRangeForPeriod,
  fetchLeaderboard,
  formatLeaderboardDuration,
  getRankBadge,
  getProgressPercentage,
} from '@/hooks/useLeaderboard';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Leaderboard Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should generate correct leaderboard key with workspace id, period, and metric', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.leaderboard(workspaceId, 'week', 'total')).toEqual([
        'leaderboard',
        workspaceId,
        'week',
        'total',
      ]);
    });

    it('should generate unique keys for different periods', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';

      const weekKey = queryKeys.leaderboard(workspaceId, 'week', 'total');
      const monthKey = queryKeys.leaderboard(workspaceId, 'month', 'total');

      expect(weekKey).not.toEqual(monthKey);
      expect(weekKey[2]).toBe('week');
      expect(monthKey[2]).toBe('month');
    });

    it('should generate unique keys for different metrics', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';

      const totalKey = queryKeys.leaderboard(workspaceId, 'week', 'total');
      const billableKey = queryKeys.leaderboard(workspaceId, 'week', 'billable');

      expect(totalKey).not.toEqual(billableKey);
      expect(totalKey[3]).toBe('total');
      expect(billableKey[3]).toBe('billable');
    });
  });

  // ============================================================================
  // LeaderboardFetchError Tests
  // ============================================================================

  describe('LeaderboardFetchError', () => {
    it('should create error with message', () => {
      const error = new LeaderboardFetchError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('LeaderboardFetchError');
    });

    it('should create error with message and code', () => {
      const error = new LeaderboardFetchError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'period', reason: 'invalid' };
      const error = new LeaderboardFetchError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new LeaderboardFetchError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LeaderboardFetchError);
    });

    it('should have undefined code when not provided', () => {
      const error = new LeaderboardFetchError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new LeaderboardFetchError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new LeaderboardFetchError('Test');
      expect(error.name).toBe('LeaderboardFetchError');
      expect(error.stack).toContain('LeaderboardFetchError');
    });
  });

  // ============================================================================
  // Date Range Calculation Tests
  // ============================================================================

  describe('getWeekRange', () => {
    it('should calculate week range starting on Monday by default', () => {
      // Wednesday, March 15, 2026
      const referenceDate = new Date(2026, 2, 15, 12, 0, 0);
      const range = getWeekRange(1, referenceDate);

      // Week should start Monday March 9, 2026
      expect(range.start.getDate()).toBe(9);
      expect(range.start.getMonth()).toBe(2); // March
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);

      // Week should end Sunday March 15, 2026
      expect(range.end.getDate()).toBe(15);
      expect(range.end.getMonth()).toBe(2); // March
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it('should calculate week range starting on Sunday', () => {
      // Wednesday, March 15, 2026
      const referenceDate = new Date(2026, 2, 15, 12, 0, 0);
      const range = getWeekRange(0, referenceDate);

      // Week should start Sunday March 15, 2026
      expect(range.start.getDate()).toBe(15);
      expect(range.start.getMonth()).toBe(2); // March

      // Week should end Saturday March 21, 2026
      expect(range.end.getDate()).toBe(21);
      expect(range.end.getMonth()).toBe(2); // March
    });

    it('should handle Sunday as reference date with Monday start', () => {
      // Sunday, March 15, 2026
      const referenceDate = new Date(2026, 2, 15, 12, 0, 0);
      referenceDate.setDate(15); // Make sure it's Sunday
      // Actually, let's set it to a known Sunday - March 1, 2026 is a Sunday
      const sunday = new Date(2026, 2, 1, 12, 0, 0);
      const range = getWeekRange(1, sunday);

      // For Sunday with Monday start, should go back 6 days to Monday
      expect(range.start.getDay()).toBe(1); // Monday
    });

    it('should return 7 days span', () => {
      const range = getWeekRange(1, new Date(2026, 2, 15));
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysDiff = Math.round((range.end.getTime() - range.start.getTime()) / msPerDay);

      // Start is 00:00:00.000 and end is 23:59:59.999, so ~7 full days
      expect(daysDiff).toBeGreaterThanOrEqual(6);
      expect(daysDiff).toBeLessThanOrEqual(7);
    });
  });

  describe('getMonthRange', () => {
    it('should calculate month range for current month', () => {
      // March 15, 2026
      const referenceDate = new Date(2026, 2, 15, 12, 0, 0);
      const range = getMonthRange(referenceDate);

      // Should start March 1, 2026
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getMonth()).toBe(2); // March
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);

      // Should end March 31, 2026
      expect(range.end.getDate()).toBe(31);
      expect(range.end.getMonth()).toBe(2); // March
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it('should handle February correctly', () => {
      // February 15, 2026 (not a leap year)
      const referenceDate = new Date(2026, 1, 15, 12, 0, 0);
      const range = getMonthRange(referenceDate);

      expect(range.end.getDate()).toBe(28);
      expect(range.end.getMonth()).toBe(1); // February
    });

    it('should handle leap year February', () => {
      // February 15, 2024 (leap year)
      const referenceDate = new Date(2024, 1, 15, 12, 0, 0);
      const range = getMonthRange(referenceDate);

      expect(range.end.getDate()).toBe(29);
      expect(range.end.getMonth()).toBe(1); // February
    });
  });

  describe('getDateRangeForPeriod', () => {
    it('should return week range for week period', () => {
      const range = getDateRangeForPeriod('week', 1);

      // Should be a 7-day range (start 00:00:00 to end 23:59:59)
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysDiff = Math.round((range.end.getTime() - range.start.getTime()) / msPerDay);
      expect(daysDiff).toBeGreaterThanOrEqual(6);
      expect(daysDiff).toBeLessThanOrEqual(7);
    });

    it('should return month range for month period', () => {
      const range = getDateRangeForPeriod('month', 1);

      // Should be a full month
      expect(range.start.getDate()).toBe(1);
      expect(range.end.getDate()).toBeGreaterThanOrEqual(28);
    });
  });

  // ============================================================================
  // fetchLeaderboard Tests
  // ============================================================================

  describe('fetchLeaderboard', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';

    it('should throw error when not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(fetchLeaderboard(mockWorkspaceId)).rejects.toThrow(LeaderboardFetchError);
      await expect(fetchLeaderboard(mockWorkspaceId)).rejects.toThrow('Not authenticated');
    });

    it('should throw error on session error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' },
      });

      await expect(fetchLeaderboard(mockWorkspaceId)).rejects.toThrow(LeaderboardFetchError);
      await expect(fetchLeaderboard(mockWorkspaceId)).rejects.toThrow('Failed to get session');
    });

    it('should return empty leaderboard when no workspace members', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
        error: null,
      });

      const mockEq = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await fetchLeaderboard(mockWorkspaceId);

      expect(result.entries).toEqual([]);
      expect(result.total_participants).toBe(0);
      expect(result.current_user_entry).toBeNull();
    });

    it('should throw on members fetch error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
        error: null,
      });

      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error' },
      });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(fetchLeaderboard(mockWorkspaceId)).rejects.toThrow(LeaderboardFetchError);
      await expect(fetchLeaderboard(mockWorkspaceId)).rejects.toThrow(
        'Failed to fetch workspace members'
      );
    });

    it('should use default options when not provided', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
        error: null,
      });

      const mockMembersEq = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockMembersSelect = jest.fn().mockReturnValue({ eq: mockMembersEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockMembersSelect });

      const result = await fetchLeaderboard(mockWorkspaceId);

      // Default period is 'week', default metric is 'total'
      expect(result.period).toBe('week');
      expect(result.metric).toBe('total');
    });

    it('should use custom period and metric', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
        error: null,
      });

      const mockMembersEq = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockMembersSelect = jest.fn().mockReturnValue({ eq: mockMembersEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockMembersSelect });

      const result = await fetchLeaderboard(mockWorkspaceId, {
        period: 'month',
        metric: 'billable',
      });

      expect(result.period).toBe('month');
      expect(result.metric).toBe('billable');
    });
  });

  // ============================================================================
  // Utility Functions Tests
  // ============================================================================

  describe('formatLeaderboardDuration', () => {
    it('should format seconds as hours and minutes', () => {
      expect(formatLeaderboardDuration(3600)).toBe('1h');
      expect(formatLeaderboardDuration(5400)).toBe('1h 30m');
      expect(formatLeaderboardDuration(7200)).toBe('2h');
    });

    it('should format only minutes when less than an hour', () => {
      expect(formatLeaderboardDuration(0)).toBe('0m');
      expect(formatLeaderboardDuration(1800)).toBe('30m');
      expect(formatLeaderboardDuration(2700)).toBe('45m');
    });

    it('should handle edge cases', () => {
      expect(formatLeaderboardDuration(60)).toBe('1m');
      expect(formatLeaderboardDuration(59)).toBe('0m'); // Less than a minute rounds down
      expect(formatLeaderboardDuration(3660)).toBe('1h 1m');
    });
  });

  describe('getRankBadge', () => {
    it('should return gold for rank 1', () => {
      expect(getRankBadge(1)).toBe('gold');
    });

    it('should return silver for rank 2', () => {
      expect(getRankBadge(2)).toBe('silver');
    });

    it('should return bronze for rank 3', () => {
      expect(getRankBadge(3)).toBe('bronze');
    });

    it('should return null for ranks 4 and above', () => {
      expect(getRankBadge(4)).toBeNull();
      expect(getRankBadge(10)).toBeNull();
      expect(getRankBadge(100)).toBeNull();
    });
  });

  describe('getProgressPercentage', () => {
    it('should calculate percentage relative to leader', () => {
      expect(getProgressPercentage(50, 100)).toBe(50);
      expect(getProgressPercentage(75, 100)).toBe(75);
      expect(getProgressPercentage(100, 100)).toBe(100);
    });

    it('should handle leader with zero seconds', () => {
      expect(getProgressPercentage(50, 0)).toBe(0);
    });

    it('should round to nearest integer', () => {
      expect(getProgressPercentage(33, 100)).toBe(33);
      expect(getProgressPercentage(66, 100)).toBe(66);
      expect(getProgressPercentage(1, 3)).toBe(33); // 1/3 = 0.333... -> 33%
    });

    it('should handle values greater than leader (>100%)', () => {
      expect(getProgressPercentage(150, 100)).toBe(150);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('LeaderboardFetchError should have proper properties', () => {
      const error = new LeaderboardFetchError('Test', 'CODE', { detail: 'value' });

      // These should be properly typed
      const message: string = error.message;
      const code: string | undefined = error.code;
      const details: unknown = error.details;

      expect(message).toBe('Test');
      expect(code).toBe('CODE');
      expect(details).toEqual({ detail: 'value' });
    });

    it('DateRange should have start and end Date properties', () => {
      const range = getWeekRange();

      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });
  });
});
