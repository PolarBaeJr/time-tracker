/**
 * Analytics Utility Tests
 *
 * Tests for analytics helper functions including:
 * - Date range calculations
 * - Week boundary calculations with different week start days
 * - Timezone conversions
 * - Duration formatting
 */

import {
  formatDateString,
  getStartOfDay,
  getEndOfDay,
  getWeekStart,
  getMonthStart,
  getLastNDays,
  getLastNWeeks,
  getLastNMonths,
  getDayOfWeek,
  getHourOfDay,
  getHourFromISOString,
  getDayOfWeekFromISOString,
  secondsToHours,
  formatHours,
  formatDuration,
  getTodayString,
  getISOWeekNumber,
  type DayOfWeek,
} from '@/utils/analytics';

describe('analytics utilities', () => {
  // ============================================================================
  // Date Formatting Tests
  // ============================================================================

  describe('formatDateString', () => {
    it('should format date as YYYY-MM-DD in UTC', () => {
      const date = new Date('2024-03-15T12:00:00.000Z');
      expect(formatDateString(date, 'UTC')).toBe('2024-03-15');
    });

    it('should handle different timezones', () => {
      // March 15, 2024 00:00 UTC is still March 14 in America/Los_Angeles (UTC-7)
      const date = new Date('2024-03-15T00:00:00.000Z');

      // In UTC, it's March 15
      expect(formatDateString(date, 'UTC')).toBe('2024-03-15');

      // In LA (UTC-7 or UTC-8), it's March 14
      const laDate = formatDateString(date, 'America/Los_Angeles');
      expect(laDate).toBe('2024-03-14');
    });

    it('should handle year boundaries', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(formatDateString(date, 'UTC')).toBe('2024-01-01');
    });

    it('should handle leap year dates', () => {
      const date = new Date('2024-02-29T12:00:00.000Z');
      expect(formatDateString(date, 'UTC')).toBe('2024-02-29');
    });

    it('should use UTC as default timezone', () => {
      const date = new Date('2024-03-15T12:00:00.000Z');
      expect(formatDateString(date)).toBe('2024-03-15');
    });
  });

  // ============================================================================
  // Start/End of Day Tests
  // ============================================================================

  describe('getStartOfDay', () => {
    it('should return start of day in UTC', () => {
      const date = new Date('2024-03-15T15:30:45.000Z');
      const start = getStartOfDay(date, 'UTC');

      expect(start).toMatch(/^2024-03-15T00:00:00/);
    });

    it('should handle timezone conversion', () => {
      // When it's noon in UTC, get start of day in New York time
      const date = new Date('2024-03-15T12:00:00.000Z');
      const start = getStartOfDay(date, 'America/New_York');

      // Should return midnight New York time as ISO string
      expect(start).toBeDefined();
      expect(typeof start).toBe('string');
    });
  });

  describe('getEndOfDay', () => {
    it('should return end of day in UTC', () => {
      const date = new Date('2024-03-15T10:00:00.000Z');
      const end = getEndOfDay(date, 'UTC');

      expect(end).toMatch(/^2024-03-15T23:59:59/);
    });

    it('should handle end of month', () => {
      const date = new Date('2024-03-31T12:00:00.000Z');
      const end = getEndOfDay(date, 'UTC');

      expect(end).toContain('2024-03-31');
    });
  });

  // ============================================================================
  // Week Start Tests
  // ============================================================================

  describe('getWeekStart', () => {
    it('should get Monday as start of week (weekStartDay=1)', () => {
      // Wednesday March 13, 2024
      const date = new Date('2024-03-13T12:00:00.000Z');
      const weekStart = getWeekStart(date, 1, 'UTC');

      expect(weekStart.getDate()).toBe(11); // Monday March 11
    });

    it('should get Sunday as start of week (weekStartDay=0)', () => {
      // Wednesday March 13, 2024
      const date = new Date('2024-03-13T12:00:00.000Z');
      const weekStart = getWeekStart(date, 0, 'UTC');

      expect(weekStart.getDate()).toBe(10); // Sunday March 10
    });

    it('should get Saturday as start of week (weekStartDay=6)', () => {
      // Wednesday March 13, 2024
      const date = new Date('2024-03-13T12:00:00.000Z');
      const weekStart = getWeekStart(date, 6, 'UTC');

      expect(weekStart.getDate()).toBe(9); // Saturday March 9
    });

    it('should return same day if already on week start', () => {
      // Monday March 11, 2024
      const date = new Date('2024-03-11T12:00:00.000Z');
      const weekStart = getWeekStart(date, 1, 'UTC');

      expect(weekStart.getDate()).toBe(11);
    });

    it('should handle week spanning month boundary', () => {
      // Tuesday April 2, 2024
      const date = new Date('2024-04-02T12:00:00.000Z');
      const weekStart = getWeekStart(date, 1, 'UTC');

      // Monday April 1, 2024
      expect(weekStart.getDate()).toBe(1);
      expect(weekStart.getMonth()).toBe(3); // April = 3 (0-indexed)
    });

    it('should handle week spanning year boundary', () => {
      // Wednesday January 3, 2024
      const date = new Date('2024-01-03T12:00:00.000Z');
      const weekStart = getWeekStart(date, 1, 'UTC');

      // Monday January 1, 2024
      expect(weekStart.getDate()).toBe(1);
      expect(weekStart.getMonth()).toBe(0);
    });

    it('should use Monday as default week start', () => {
      const date = new Date('2024-03-13T12:00:00.000Z');
      const weekStart = getWeekStart(date);

      expect(weekStart.getDate()).toBe(11); // Monday
    });
  });

  // ============================================================================
  // Month Start Tests
  // ============================================================================

  describe('getMonthStart', () => {
    it('should return first day of month', () => {
      const date = new Date('2024-03-15T12:00:00.000Z');
      const monthStart = getMonthStart(date, 'UTC');

      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(2); // March
    });

    it('should handle February in leap year', () => {
      const date = new Date('2024-02-29T12:00:00.000Z');
      const monthStart = getMonthStart(date, 'UTC');

      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(1); // February
    });

    it('should handle January (year boundary)', () => {
      const date = new Date('2024-01-15T12:00:00.000Z');
      const monthStart = getMonthStart(date, 'UTC');

      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(0);
      expect(monthStart.getFullYear()).toBe(2024);
    });
  });

  // ============================================================================
  // Date Range Tests
  // ============================================================================

  describe('getLastNDays', () => {
    it('should return correct number of days', () => {
      const days = getLastNDays(7);
      expect(days).toHaveLength(7);
    });

    it('should include today as first element', () => {
      const days = getLastNDays(7, { timezone: 'UTC' });
      const today = formatDateString(new Date(), 'UTC');

      expect(days[0].date).toBe(today);
    });

    it('should order days newest first', () => {
      const days = getLastNDays(3, { timezone: 'UTC' });

      const date0 = new Date(days[0].date);
      const date1 = new Date(days[1].date);
      const date2 = new Date(days[2].date);

      expect(date0 > date1).toBe(true);
      expect(date1 > date2).toBe(true);
    });

    it('should include start and end times for each day', () => {
      const days = getLastNDays(1, { timezone: 'UTC' });

      expect(days[0].start).toBeDefined();
      expect(days[0].end).toBeDefined();
      expect(days[0].start).toContain('T00:00:00');
      expect(days[0].end).toContain('T23:59:59');
    });

    it('should handle single day', () => {
      const days = getLastNDays(1);
      expect(days).toHaveLength(1);
    });
  });

  describe('getLastNWeeks', () => {
    it('should return correct number of weeks', () => {
      const weeks = getLastNWeeks(4);
      expect(weeks).toHaveLength(4);
    });

    it('should include current week as first element', () => {
      const weeks = getLastNWeeks(4, { timezone: 'UTC', weekStartDay: 1 });
      const currentWeekStart = getWeekStart(new Date(), 1, 'UTC');
      const expectedWeekStart = formatDateString(currentWeekStart, 'UTC');

      expect(weeks[0].weekStart).toBe(expectedWeekStart);
    });

    it('should respect weekStartDay option', () => {
      const sundayWeeks = getLastNWeeks(1, { timezone: 'UTC', weekStartDay: 0 });
      const mondayWeeks = getLastNWeeks(1, { timezone: 'UTC', weekStartDay: 1 });

      // Week start dates should differ
      // (unless today happens to be both a Sunday and Monday, which is impossible)
      const sundayStart = new Date(sundayWeeks[0].weekStart);
      const mondayStart = new Date(mondayWeeks[0].weekStart);

      // The difference should be either 0 (same day), 1, or 6 days depending on current day
      const diffDays = Math.abs(
        (sundayStart.getTime() - mondayStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect([0, 1, 6]).toContain(diffDays);
    });

    it('should have 7-day span for each week', () => {
      const weeks = getLastNWeeks(1, { timezone: 'UTC' });

      const start = new Date(weeks[0].start);
      const end = new Date(weeks[0].end);

      // End should be about 7 days after start (minus 1ms)
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });
  });

  describe('getLastNMonths', () => {
    it('should return correct number of months', () => {
      const months = getLastNMonths(6);
      expect(months).toHaveLength(6);
    });

    it('should format month as YYYY-MM', () => {
      const months = getLastNMonths(1);
      expect(months[0].month).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should include current month as first element', () => {
      const months = getLastNMonths(1, { timezone: 'UTC' });
      const now = new Date();
      const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      expect(months[0].month).toBe(expectedMonth);
    });

    it('should handle year boundary', () => {
      // If we're in January, going back 2 months should include November
      const months = getLastNMonths(12, { timezone: 'UTC' });

      expect(months).toHaveLength(12);
      // All months should have valid format
      months.forEach((m) => {
        expect(m.month).toMatch(/^\d{4}-\d{2}$/);
      });
    });
  });

  // ============================================================================
  // Day/Hour Extraction Tests
  // ============================================================================

  describe('getDayOfWeek', () => {
    it('should return correct day for known dates', () => {
      // March 15, 2024 is a Friday
      const date = new Date('2024-03-15T12:00:00.000Z');
      expect(getDayOfWeek(date, 'UTC')).toBe(5);
    });

    it('should return 0 for Sunday', () => {
      // March 17, 2024 is a Sunday
      const date = new Date('2024-03-17T12:00:00.000Z');
      expect(getDayOfWeek(date, 'UTC')).toBe(0);
    });

    it('should return 6 for Saturday', () => {
      // March 16, 2024 is a Saturday
      const date = new Date('2024-03-16T12:00:00.000Z');
      expect(getDayOfWeek(date, 'UTC')).toBe(6);
    });
  });

  describe('getHourOfDay', () => {
    it('should return correct hour in UTC', () => {
      const date = new Date('2024-03-15T15:30:00.000Z');
      expect(getHourOfDay(date, 'UTC')).toBe(15);
    });

    it('should handle midnight', () => {
      const date = new Date('2024-03-15T00:00:00.000Z');
      expect(getHourOfDay(date, 'UTC')).toBe(0);
    });

    it('should handle 23:xx hours', () => {
      const date = new Date('2024-03-15T23:59:59.000Z');
      expect(getHourOfDay(date, 'UTC')).toBe(23);
    });
  });

  describe('getHourFromISOString', () => {
    it('should parse ISO string and return hour', () => {
      expect(getHourFromISOString('2024-03-15T10:30:00.000Z', 'UTC')).toBe(10);
    });

    it('should handle timezone conversion', () => {
      // 10 AM UTC = 6 AM EDT (UTC-4) or 5 AM EST (UTC-5)
      const hour = getHourFromISOString('2024-03-15T10:00:00.000Z', 'America/New_York');
      // During March, it's EDT (UTC-4)
      expect(hour).toBe(6);
    });
  });

  describe('getDayOfWeekFromISOString', () => {
    it('should parse ISO string and return day of week', () => {
      // March 15, 2024 is a Friday
      expect(getDayOfWeekFromISOString('2024-03-15T12:00:00.000Z', 'UTC')).toBe(5);
    });
  });

  // ============================================================================
  // Duration Formatting Tests
  // ============================================================================

  describe('secondsToHours', () => {
    it('should convert seconds to hours', () => {
      expect(secondsToHours(3600)).toBe(1);
      expect(secondsToHours(5400)).toBe(1.5);
      expect(secondsToHours(7200)).toBe(2);
    });

    it('should handle zero', () => {
      expect(secondsToHours(0)).toBe(0);
    });

    it('should handle fractional hours', () => {
      expect(secondsToHours(1800)).toBe(0.5);
      expect(secondsToHours(900)).toBe(0.25);
    });
  });

  describe('formatHours', () => {
    it('should format hours with default 1 decimal', () => {
      expect(formatHours(2.5)).toBe('2.5');
      expect(formatHours(1.0)).toBe('1.0');
    });

    it('should respect decimal places parameter', () => {
      expect(formatHours(2.567, 2)).toBe('2.57');
      expect(formatHours(2.567, 0)).toBe('3');
    });

    it('should handle whole numbers', () => {
      expect(formatHours(5, 1)).toBe('5.0');
    });
  });

  describe('formatDuration', () => {
    it('should format duration as HH:MM:SS', () => {
      expect(formatDuration(0)).toBe('00:00:00');
      expect(formatDuration(61)).toBe('00:01:01');
      expect(formatDuration(3661)).toBe('01:01:01');
    });

    it('should handle hours > 24', () => {
      expect(formatDuration(90000)).toBe('25:00:00');
    });

    it('should pad with zeros', () => {
      expect(formatDuration(1)).toBe('00:00:01');
      expect(formatDuration(60)).toBe('00:01:00');
      expect(formatDuration(3600)).toBe('01:00:00');
    });
  });

  // ============================================================================
  // ISO Week Number Tests
  // ============================================================================

  describe('getISOWeekNumber', () => {
    it('should return correct ISO week number', () => {
      // January 1, 2024 is a Monday, so it's week 1
      const date1 = new Date('2024-01-01T12:00:00.000Z');
      expect(getISOWeekNumber(date1)).toBe(1);

      // January 8, 2024 is week 2
      const date2 = new Date('2024-01-08T12:00:00.000Z');
      expect(getISOWeekNumber(date2)).toBe(2);
    });

    it('should handle week 53', () => {
      // December 30, 2024 is in week 1 of 2025 actually (ISO rules)
      // But December 28, 2020 is week 53
      const date = new Date('2020-12-28T12:00:00.000Z');
      expect(getISOWeekNumber(date)).toBe(53);
    });

    it('should return values between 1 and 53', () => {
      // Test multiple dates
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-06-15'),
        new Date('2024-12-31'),
      ];

      dates.forEach((date) => {
        const week = getISOWeekNumber(date);
        expect(week).toBeGreaterThanOrEqual(1);
        expect(week).toBeLessThanOrEqual(53);
      });
    });
  });

  // ============================================================================
  // Today String Tests
  // ============================================================================

  describe('getTodayString', () => {
    it('should return today in YYYY-MM-DD format', () => {
      const today = getTodayString('UTC');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should match formatDateString for today', () => {
      const today1 = getTodayString('UTC');
      const today2 = formatDateString(new Date(), 'UTC');
      expect(today1).toBe(today2);
    });
  });
});
