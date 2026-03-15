/**
 * Achievement Service Tests
 *
 * Tests for achievement calculation logic including:
 * - Streak calculation
 * - Total hours calculation
 * - Progress text formatting
 * - Would-unlock predicate
 */

import {
  calculateStreak,
  calculateTotalHours,
  wouldUnlock,
  getProgressText,
} from '@/services/achievementService';

describe('Achievement Service', () => {
  describe('calculateStreak', () => {
    // Helper to create a time entry for a given date
    const createEntry = (dateStr: string, durationSeconds = 3600) => ({
      start_at: `${dateStr}T12:00:00.000Z`,
      duration_seconds: durationSeconds,
    });

    // Helper to get ISO date string for N days ago
    const daysAgo = (n: number): string => {
      const date = new Date();
      date.setDate(date.getDate() - n);
      return date.toISOString().split('T')[0];
    };

    it('should return 0 for empty entries', () => {
      expect(calculateStreak([])).toBe(0);
    });

    it('should return 1 for a single entry today', () => {
      const entries = [createEntry(daysAgo(0))];
      expect(calculateStreak(entries)).toBe(1);
    });

    it('should return 1 for a single entry yesterday', () => {
      const entries = [createEntry(daysAgo(1))];
      expect(calculateStreak(entries)).toBe(1);
    });

    it('should return 0 for entries only 2+ days ago', () => {
      const entries = [createEntry(daysAgo(2))];
      expect(calculateStreak(entries)).toBe(0);
    });

    it('should count consecutive days correctly', () => {
      const entries = [
        createEntry(daysAgo(0)), // Today
        createEntry(daysAgo(1)), // Yesterday
        createEntry(daysAgo(2)), // 2 days ago
      ];
      expect(calculateStreak(entries)).toBe(3);
    });

    it('should stop counting at gaps', () => {
      const entries = [
        createEntry(daysAgo(0)), // Today
        createEntry(daysAgo(1)), // Yesterday
        // Gap at 2 days ago
        createEntry(daysAgo(3)), // 3 days ago
        createEntry(daysAgo(4)), // 4 days ago
      ];
      expect(calculateStreak(entries)).toBe(2);
    });

    it('should count multiple entries on the same day as one day', () => {
      const date = daysAgo(0);
      const entries = [
        { start_at: `${date}T08:00:00.000Z`, duration_seconds: 1800 },
        { start_at: `${date}T10:00:00.000Z`, duration_seconds: 3600 },
        { start_at: `${date}T14:00:00.000Z`, duration_seconds: 2400 },
      ];
      expect(calculateStreak(entries)).toBe(1);
    });

    it('should handle entries in any order', () => {
      const entries = [
        createEntry(daysAgo(2)), // Out of order
        createEntry(daysAgo(0)),
        createEntry(daysAgo(1)),
      ];
      expect(calculateStreak(entries)).toBe(3);
    });

    it('should return correct streak starting from yesterday', () => {
      // User hasn't tracked today yet, but had a streak ending yesterday
      const entries = [createEntry(daysAgo(1)), createEntry(daysAgo(2)), createEntry(daysAgo(3))];
      expect(calculateStreak(entries)).toBe(3);
    });

    it('should handle week-long streak', () => {
      const entries = Array.from({ length: 7 }, (_, i) => createEntry(daysAgo(i)));
      expect(calculateStreak(entries)).toBe(7);
    });

    it('should handle month-long streak', () => {
      const entries = Array.from({ length: 30 }, (_, i) => createEntry(daysAgo(i)));
      expect(calculateStreak(entries)).toBe(30);
    });
  });

  describe('calculateTotalHours', () => {
    it('should return 0 for empty entries', () => {
      expect(calculateTotalHours([])).toBe(0);
    });

    it('should calculate hours from seconds correctly', () => {
      const entries = [
        { start_at: '2024-03-15T10:00:00.000Z', duration_seconds: 3600 }, // 1 hour
      ];
      expect(calculateTotalHours(entries)).toBe(1);
    });

    it('should sum multiple entries', () => {
      const entries = [
        { start_at: '2024-03-15T10:00:00.000Z', duration_seconds: 3600 }, // 1 hour
        { start_at: '2024-03-15T14:00:00.000Z', duration_seconds: 7200 }, // 2 hours
        { start_at: '2024-03-15T18:00:00.000Z', duration_seconds: 1800 }, // 0.5 hours
      ];
      expect(calculateTotalHours(entries)).toBe(3.5);
    });

    it('should handle decimal hours', () => {
      const entries = [
        { start_at: '2024-03-15T10:00:00.000Z', duration_seconds: 5400 }, // 1.5 hours
      ];
      expect(calculateTotalHours(entries)).toBe(1.5);
    });

    it('should handle zero duration entries', () => {
      const entries = [
        { start_at: '2024-03-15T10:00:00.000Z', duration_seconds: 0 },
        { start_at: '2024-03-15T11:00:00.000Z', duration_seconds: 3600 },
      ];
      expect(calculateTotalHours(entries)).toBe(1);
    });

    it('should handle large totals', () => {
      // 100 hours worth of entries
      const entries = Array.from({ length: 100 }, (_, i) => ({
        start_at: `2024-03-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        duration_seconds: 3600, // 1 hour each
      }));
      expect(calculateTotalHours(entries)).toBe(100);
    });
  });

  describe('wouldUnlock', () => {
    it('should return true when progress meets target', () => {
      expect(wouldUnlock('STREAK_3', 3)).toBe(true);
      expect(wouldUnlock('TIME_10H', 10)).toBe(true);
      expect(wouldUnlock('FIRST_ENTRY', 1)).toBe(true);
    });

    it('should return true when progress exceeds target', () => {
      expect(wouldUnlock('STREAK_3', 5)).toBe(true);
      expect(wouldUnlock('TIME_50H', 75)).toBe(true);
    });

    it('should return false when progress below target', () => {
      expect(wouldUnlock('STREAK_3', 2)).toBe(false);
      expect(wouldUnlock('TIME_100H', 50)).toBe(false);
      expect(wouldUnlock('FIRST_ENTRY', 0)).toBe(false);
    });

    it('should return false for invalid achievement ID', () => {
      // Type assertion needed since we're testing invalid input
      expect(wouldUnlock('INVALID_ID' as never, 100)).toBe(false);
    });

    it('should handle zero progress', () => {
      expect(wouldUnlock('STREAK_7', 0)).toBe(false);
    });
  });

  describe('getProgressText', () => {
    describe('streak achievements', () => {
      it('should format days correctly', () => {
        expect(getProgressText('STREAK_3', 2)).toBe('2/3 days');
        expect(getProgressText('STREAK_7', 5)).toBe('5/7 days');
        expect(getProgressText('STREAK_30', 15)).toBe('15/30 days');
      });

      it('should show completed streak', () => {
        expect(getProgressText('STREAK_3', 3)).toBe('3/3 days');
      });

      it('should show over-completed streak', () => {
        expect(getProgressText('STREAK_7', 10)).toBe('10/7 days');
      });

      it('should truncate decimal days', () => {
        // Streaks should always be whole numbers
        expect(getProgressText('STREAK_3', 2.5)).toBe('2/3 days');
      });
    });

    describe('time achievements', () => {
      it('should format hours correctly', () => {
        expect(getProgressText('TIME_10H', 5)).toBe('5.0/10 hours');
        expect(getProgressText('TIME_50H', 25.5)).toBe('25.5/50 hours');
        expect(getProgressText('TIME_100H', 99.9)).toBe('99.9/100 hours');
      });

      it('should show one decimal place', () => {
        expect(getProgressText('TIME_10H', 7.333)).toBe('7.3/10 hours');
      });
    });

    describe('first achievements', () => {
      it('should show "Not yet" when incomplete', () => {
        expect(getProgressText('FIRST_ENTRY', 0)).toBe('Not yet');
        expect(getProgressText('FIRST_CATEGORY', 0)).toBe('Not yet');
        expect(getProgressText('FIRST_GOAL', 0)).toBe('Not yet');
      });

      it('should show "Completed" when done', () => {
        expect(getProgressText('FIRST_ENTRY', 1)).toBe('Completed');
        expect(getProgressText('FIRST_CATEGORY', 1)).toBe('Completed');
        expect(getProgressText('FIRST_GOAL', 1)).toBe('Completed');
      });

      it('should show "Completed" for values > 1', () => {
        expect(getProgressText('FIRST_ENTRY', 5)).toBe('Completed');
      });
    });

    describe('invalid achievement', () => {
      it('should return raw progress for invalid ID', () => {
        expect(getProgressText('INVALID_ID' as never, 42)).toBe('42');
      });
    });
  });
});

describe('Streak Edge Cases', () => {
  const createEntry = (dateStr: string) => ({
    start_at: `${dateStr}T12:00:00.000Z`,
    duration_seconds: 3600,
  });

  const daysAgo = (n: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().split('T')[0];
  };

  it('should handle timezone boundary entries', () => {
    const date = daysAgo(0);
    const entries = [
      // Entry at very end of previous day (UTC)
      { start_at: `${daysAgo(1)}T23:59:59.000Z`, duration_seconds: 60 },
      // Entry at very start of today (UTC)
      { start_at: `${date}T00:00:00.000Z`, duration_seconds: 60 },
    ];
    expect(calculateStreak(entries)).toBe(2);
  });

  it('should handle single very short entry', () => {
    const entries = [
      { start_at: `${daysAgo(0)}T12:00:00.000Z`, duration_seconds: 1 }, // 1 second
    ];
    expect(calculateStreak(entries)).toBe(1);
  });

  it('should handle entries spanning midnight', () => {
    // This tests that we use start_at date, not end time
    const entries = [
      { start_at: `${daysAgo(1)}T23:00:00.000Z`, duration_seconds: 7200 }, // Started yesterday, ended today
      { start_at: `${daysAgo(2)}T12:00:00.000Z`, duration_seconds: 3600 },
    ];
    expect(calculateStreak(entries)).toBe(2); // Should count as 2 days based on start dates
  });
});
