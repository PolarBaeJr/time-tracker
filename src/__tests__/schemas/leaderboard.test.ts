/**
 * Leaderboard Schema Tests
 *
 * Tests all leaderboard Zod schemas with valid and invalid inputs.
 * Tests LeaderboardPeriodEnum, LeaderboardMetricEnum, LeaderboardEntrySchema,
 * LeaderboardResponseSchema, LeaderboardQuerySchema, etc.
 */

import {
  LeaderboardPeriodEnum,
  LeaderboardMetricEnum,
  LeaderboardEntrySchema,
  LeaderboardEntryWithAvatarSchema,
  LeaderboardResponseSchema,
  LeaderboardStatsSchema,
  LeaderboardQuerySchema,
  PERIOD_NAMES,
  METRIC_NAMES,
  LEADERBOARD_STALE_TIME,
  RANK_BADGES,
} from '@/schemas/leaderboard';

describe('Leaderboard Schemas', () => {
  // ============================================================================
  // Enums Tests
  // ============================================================================

  describe('LeaderboardPeriodEnum', () => {
    it('should accept valid period values', () => {
      expect(LeaderboardPeriodEnum.safeParse('week').success).toBe(true);
      expect(LeaderboardPeriodEnum.safeParse('month').success).toBe(true);
    });

    it('should reject invalid period values', () => {
      expect(LeaderboardPeriodEnum.safeParse('day').success).toBe(false);
      expect(LeaderboardPeriodEnum.safeParse('year').success).toBe(false);
      expect(LeaderboardPeriodEnum.safeParse('').success).toBe(false);
      expect(LeaderboardPeriodEnum.safeParse(null).success).toBe(false);
    });
  });

  describe('LeaderboardMetricEnum', () => {
    it('should accept valid metric values', () => {
      expect(LeaderboardMetricEnum.safeParse('total').success).toBe(true);
      expect(LeaderboardMetricEnum.safeParse('billable').success).toBe(true);
    });

    it('should reject invalid metric values', () => {
      expect(LeaderboardMetricEnum.safeParse('non-billable').success).toBe(false);
      expect(LeaderboardMetricEnum.safeParse('average').success).toBe(false);
      expect(LeaderboardMetricEnum.safeParse('').success).toBe(false);
      expect(LeaderboardMetricEnum.safeParse(null).success).toBe(false);
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('Constants', () => {
    it('should have correct period names', () => {
      expect(PERIOD_NAMES.week).toBe('This Week');
      expect(PERIOD_NAMES.month).toBe('This Month');
    });

    it('should have correct metric names', () => {
      expect(METRIC_NAMES.total).toBe('All Hours');
      expect(METRIC_NAMES.billable).toBe('Billable Hours');
    });

    it('should have correct stale time (5 minutes)', () => {
      expect(LEADERBOARD_STALE_TIME).toBe(5 * 60 * 1000);
      expect(LEADERBOARD_STALE_TIME).toBe(300000);
    });

    it('should have correct rank badges', () => {
      expect(RANK_BADGES.GOLD).toBe(1);
      expect(RANK_BADGES.SILVER).toBe(2);
      expect(RANK_BADGES.BRONZE).toBe(3);
    });
  });

  // ============================================================================
  // LeaderboardEntrySchema Tests
  // ============================================================================

  describe('LeaderboardEntrySchema', () => {
    const validEntry = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
      total_seconds: 36000,
      rank: 1,
      is_current_user: true,
    };

    it('should accept valid entry data', () => {
      const result = LeaderboardEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for user_id', () => {
      const result = LeaderboardEntrySchema.safeParse({ ...validEntry, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid email', () => {
      const result = LeaderboardEntrySchema.safeParse({ ...validEntry, email: 'invalid-email' });
      expect(result.success).toBe(false);
    });

    it('should require non-negative total_seconds', () => {
      expect(LeaderboardEntrySchema.safeParse({ ...validEntry, total_seconds: 0 }).success).toBe(
        true
      );
      expect(LeaderboardEntrySchema.safeParse({ ...validEntry, total_seconds: -1 }).success).toBe(
        false
      );
    });

    it('should require positive rank (1-indexed)', () => {
      expect(LeaderboardEntrySchema.safeParse({ ...validEntry, rank: 1 }).success).toBe(true);
      expect(LeaderboardEntrySchema.safeParse({ ...validEntry, rank: 100 }).success).toBe(true);
      expect(LeaderboardEntrySchema.safeParse({ ...validEntry, rank: 0 }).success).toBe(false);
      expect(LeaderboardEntrySchema.safeParse({ ...validEntry, rank: -1 }).success).toBe(false);
    });

    it('should allow optional is_current_user', () => {
      const { is_current_user, ...withoutCurrentUser } = validEntry;
      const result = LeaderboardEntrySchema.safeParse(withoutCurrentUser);
      expect(result.success).toBe(true);
    });

    it('should accept boolean for is_current_user', () => {
      expect(
        LeaderboardEntrySchema.safeParse({ ...validEntry, is_current_user: true }).success
      ).toBe(true);
      expect(
        LeaderboardEntrySchema.safeParse({ ...validEntry, is_current_user: false }).success
      ).toBe(true);
    });

    it('should reject missing required fields', () => {
      const { user_id, ...withoutUserId } = validEntry;
      expect(LeaderboardEntrySchema.safeParse(withoutUserId).success).toBe(false);

      const { name, ...withoutName } = validEntry;
      expect(LeaderboardEntrySchema.safeParse(withoutName).success).toBe(false);

      const { email, ...withoutEmail } = validEntry;
      expect(LeaderboardEntrySchema.safeParse(withoutEmail).success).toBe(false);

      const { total_seconds, ...withoutSeconds } = validEntry;
      expect(LeaderboardEntrySchema.safeParse(withoutSeconds).success).toBe(false);

      const { rank, ...withoutRank } = validEntry;
      expect(LeaderboardEntrySchema.safeParse(withoutRank).success).toBe(false);
    });
  });

  // ============================================================================
  // LeaderboardEntryWithAvatarSchema Tests
  // ============================================================================

  describe('LeaderboardEntryWithAvatarSchema', () => {
    const validEntryWithAvatar = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
      total_seconds: 36000,
      rank: 1,
      avatar_url: 'https://example.com/avatar.jpg',
      initials: 'JD',
    };

    it('should accept valid entry with avatar', () => {
      const result = LeaderboardEntryWithAvatarSchema.safeParse(validEntryWithAvatar);
      expect(result.success).toBe(true);
    });

    it('should allow null avatar_url', () => {
      const result = LeaderboardEntryWithAvatarSchema.safeParse({
        ...validEntryWithAvatar,
        avatar_url: null,
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional avatar_url and initials', () => {
      const { avatar_url, initials, ...withoutAvatar } = validEntryWithAvatar;
      const result = LeaderboardEntryWithAvatarSchema.safeParse(withoutAvatar);
      expect(result.success).toBe(true);
    });

    it('should validate avatar_url as valid URL', () => {
      expect(
        LeaderboardEntryWithAvatarSchema.safeParse({
          ...validEntryWithAvatar,
          avatar_url: 'not-a-url',
        }).success
      ).toBe(false);
    });

    it('should validate initials max length (2)', () => {
      expect(
        LeaderboardEntryWithAvatarSchema.safeParse({ ...validEntryWithAvatar, initials: 'JD' })
          .success
      ).toBe(true);
      expect(
        LeaderboardEntryWithAvatarSchema.safeParse({ ...validEntryWithAvatar, initials: 'JDX' })
          .success
      ).toBe(false);
    });
  });

  // ============================================================================
  // LeaderboardResponseSchema Tests
  // ============================================================================

  describe('LeaderboardResponseSchema', () => {
    const validResponse = {
      period: 'week',
      metric: 'total',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      date_range: {
        start: '2024-03-04T00:00:00.000Z',
        end: '2024-03-10T23:59:59.999Z',
      },
      entries: [
        {
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Top User',
          email: 'top@example.com',
          total_seconds: 50000,
          rank: 1,
        },
        {
          user_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Second User',
          email: 'second@example.com',
          total_seconds: 40000,
          rank: 2,
        },
      ],
      current_user_entry: null,
      total_participants: 2,
      calculated_at: '2024-03-10T12:00:00.000Z',
    };

    it('should accept valid response data', () => {
      const result = LeaderboardResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate period enum', () => {
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, period: 'week' }).success
      ).toBe(true);
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, period: 'month' }).success
      ).toBe(true);
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, period: 'invalid' }).success
      ).toBe(false);
    });

    it('should validate metric enum', () => {
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, metric: 'total' }).success
      ).toBe(true);
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, metric: 'billable' }).success
      ).toBe(true);
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, metric: 'invalid' }).success
      ).toBe(false);
    });

    it('should require valid workspace_id UUID', () => {
      const result = LeaderboardResponseSchema.safeParse({
        ...validResponse,
        workspace_id: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should require valid datetime in date_range', () => {
      expect(
        LeaderboardResponseSchema.safeParse({
          ...validResponse,
          date_range: { start: 'invalid', end: '2024-03-10T23:59:59.999Z' },
        }).success
      ).toBe(false);
      expect(
        LeaderboardResponseSchema.safeParse({
          ...validResponse,
          date_range: { start: '2024-03-04T00:00:00.000Z', end: 'invalid' },
        }).success
      ).toBe(false);
    });

    it('should accept empty entries array', () => {
      const result = LeaderboardResponseSchema.safeParse({ ...validResponse, entries: [] });
      expect(result.success).toBe(true);
    });

    it('should allow null current_user_entry', () => {
      const result = LeaderboardResponseSchema.safeParse({
        ...validResponse,
        current_user_entry: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept current_user_entry with valid data', () => {
      const result = LeaderboardResponseSchema.safeParse({
        ...validResponse,
        current_user_entry: {
          user_id: '123e4567-e89b-12d3-a456-426614174003',
          name: 'Current User',
          email: 'current@example.com',
          total_seconds: 10000,
          rank: 25,
          is_current_user: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should require non-negative total_participants', () => {
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, total_participants: 0 }).success
      ).toBe(true);
      expect(
        LeaderboardResponseSchema.safeParse({ ...validResponse, total_participants: -1 }).success
      ).toBe(false);
    });

    it('should require valid datetime for calculated_at', () => {
      const result = LeaderboardResponseSchema.safeParse({
        ...validResponse,
        calculated_at: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // LeaderboardStatsSchema Tests
  // ============================================================================

  describe('LeaderboardStatsSchema', () => {
    const validStats = {
      total_hours: 100.5,
      avg_hours_per_member: 20.1,
      leader_hours: 50.25,
      active_members: 5,
    };

    it('should accept valid stats data', () => {
      const result = LeaderboardStatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
    });

    it('should accept all zeros', () => {
      const result = LeaderboardStatsSchema.safeParse({
        total_hours: 0,
        avg_hours_per_member: 0,
        leader_hours: 0,
        active_members: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative values', () => {
      expect(LeaderboardStatsSchema.safeParse({ ...validStats, total_hours: -1 }).success).toBe(
        false
      );
      expect(
        LeaderboardStatsSchema.safeParse({ ...validStats, avg_hours_per_member: -1 }).success
      ).toBe(false);
      expect(LeaderboardStatsSchema.safeParse({ ...validStats, leader_hours: -1 }).success).toBe(
        false
      );
      expect(LeaderboardStatsSchema.safeParse({ ...validStats, active_members: -1 }).success).toBe(
        false
      );
    });

    it('should allow decimal values for hour fields', () => {
      const result = LeaderboardStatsSchema.safeParse({
        total_hours: 100.5,
        avg_hours_per_member: 20.333,
        leader_hours: 50.125,
        active_members: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should require integer for active_members', () => {
      expect(LeaderboardStatsSchema.safeParse({ ...validStats, active_members: 5.5 }).success).toBe(
        false
      );
    });
  });

  // ============================================================================
  // LeaderboardQuerySchema Tests
  // ============================================================================

  describe('LeaderboardQuerySchema', () => {
    const validQuery = {
      workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      period: 'week',
      metric: 'total',
      limit: 20,
    };

    it('should accept valid query data', () => {
      const result = LeaderboardQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it('should require valid workspace_id UUID', () => {
      const result = LeaderboardQuerySchema.safeParse({ ...validQuery, workspace_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should provide default period of week', () => {
      const result = LeaderboardQuerySchema.safeParse({
        workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe('week');
      }
    });

    it('should provide default metric of total', () => {
      const result = LeaderboardQuerySchema.safeParse({
        workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metric).toBe('total');
      }
    });

    it('should provide default limit of 20', () => {
      const result = LeaderboardQuerySchema.safeParse({
        workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('should validate limit min (positive)', () => {
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, limit: 1 }).success).toBe(true);
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, limit: 0 }).success).toBe(false);
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, limit: -1 }).success).toBe(false);
    });

    it('should validate limit max (100)', () => {
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, limit: 100 }).success).toBe(true);
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, limit: 101 }).success).toBe(false);
    });

    it('should validate period enum', () => {
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, period: 'week' }).success).toBe(
        true
      );
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, period: 'month' }).success).toBe(
        true
      );
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, period: 'invalid' }).success).toBe(
        false
      );
    });

    it('should validate metric enum', () => {
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, metric: 'total' }).success).toBe(
        true
      );
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, metric: 'billable' }).success).toBe(
        true
      );
      expect(LeaderboardQuerySchema.safeParse({ ...validQuery, metric: 'invalid' }).success).toBe(
        false
      );
    });
  });
});
