/**
 * Analytics Utility Functions
 *
 * Helper functions for date range calculations, week boundaries, and time aggregation.
 * These utilities respect user preferences for timezone and week start day.
 *
 * USAGE:
 * ```typescript
 * import { getLastNDays, getWeekStart, formatDateForQuery } from '@/utils/analytics';
 *
 * // Get date ranges for the last 7 days
 * const ranges = getLastNDays(7, { timezone: 'America/New_York' });
 *
 * // Get the start of a week based on user preference
 * const weekStart = getWeekStart(new Date(), 1); // Monday start
 * ```
 */

/**
 * Days of the week (0 = Sunday, 1 = Monday, etc.)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Options for date range calculations
 */
export interface DateRangeOptions {
  /**
   * IANA timezone identifier (e.g., 'America/New_York')
   * Defaults to 'UTC' if not specified
   */
  timezone?: string;

  /**
   * Day of week to start weeks on (0=Sunday through 6=Saturday)
   * Defaults to 1 (Monday) if not specified
   */
  weekStartDay?: DayOfWeek;
}

/**
 * Represents a single day with its date range
 */
export interface DayRange {
  /** The date in YYYY-MM-DD format */
  date: string;
  /** Start of day as ISO 8601 datetime */
  start: string;
  /** End of day as ISO 8601 datetime */
  end: string;
}

/**
 * Represents a week with its date range
 */
export interface WeekRange {
  /** Start of week date in YYYY-MM-DD format */
  weekStart: string;
  /** Start of week as ISO 8601 datetime */
  start: string;
  /** End of week as ISO 8601 datetime */
  end: string;
}

/**
 * Represents a month with its date range
 */
export interface MonthRange {
  /** Month in YYYY-MM format */
  month: string;
  /** Start of month as ISO 8601 datetime */
  start: string;
  /** End of month as ISO 8601 datetime */
  end: string;
}

/**
 * Format a Date object to YYYY-MM-DD string in the specified timezone
 *
 * @param date - The date to format
 * @param timezone - IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateString(date: Date, timezone = 'UTC'): string {
  // Use Intl.DateTimeFormat for timezone-aware formatting
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Get the start of a day in the specified timezone as an ISO 8601 string
 *
 * @param date - The date to get start of day for
 * @param timezone - IANA timezone identifier
 * @returns ISO 8601 datetime string
 */
export function getStartOfDay(date: Date, timezone = 'UTC'): string {
  const dateStr = formatDateString(date, timezone);
  // Create a date at midnight in the specified timezone
  // We append T00:00:00 and the timezone info
  const startDate = new Date(`${dateStr}T00:00:00`);

  // Adjust for timezone offset
  const tzOffset = getTimezoneOffset(dateStr, timezone);
  startDate.setMinutes(startDate.getMinutes() - tzOffset);

  return startDate.toISOString();
}

/**
 * Get the end of a day in the specified timezone as an ISO 8601 string
 *
 * @param date - The date to get end of day for
 * @param timezone - IANA timezone identifier
 * @returns ISO 8601 datetime string
 */
export function getEndOfDay(date: Date, timezone = 'UTC'): string {
  const dateStr = formatDateString(date, timezone);
  // Create a date at 23:59:59.999 in the specified timezone
  const endDate = new Date(`${dateStr}T23:59:59.999`);

  // Adjust for timezone offset
  const tzOffset = getTimezoneOffset(dateStr, timezone);
  endDate.setMinutes(endDate.getMinutes() - tzOffset);

  return endDate.toISOString();
}

/**
 * Get the timezone offset in minutes for a given date and timezone
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - IANA timezone identifier
 * @returns Offset in minutes from UTC
 */
function getTimezoneOffset(dateStr: string, timezone: string): number {
  // Create two dates: one in local and one interpreted as the target timezone
  const localDate = new Date(`${dateStr}T12:00:00Z`);

  // Get the parts for the timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(localDate);

  const partsMap: Record<string, string> = {};
  for (const part of parts) {
    partsMap[part.type] = part.value;
  }

  // Calculate the offset based on the formatted time vs UTC
  const tzDate = new Date(
    `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}:00Z`
  );
  const utcDate = new Date(`${dateStr}T12:00:00Z`);

  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

/**
 * Get the start of the week containing the given date
 *
 * @param date - The date to find week start for
 * @param weekStartDay - Day of week to start on (0=Sunday, 1=Monday, etc.)
 * @param timezone - IANA timezone identifier
 * @returns Date object representing start of week
 */
export function getWeekStart(date: Date, weekStartDay: DayOfWeek = 1, timezone = 'UTC'): Date {
  // Get the current day in the target timezone
  const dateStr = formatDateString(date, timezone);
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);

  const currentDay = localDate.getDay() as DayOfWeek;
  let daysToSubtract = currentDay - weekStartDay;

  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }

  const weekStart = new Date(localDate);
  weekStart.setDate(weekStart.getDate() - daysToSubtract);

  return weekStart;
}

/**
 * Get the start of the month containing the given date
 *
 * @param date - The date to find month start for
 * @param timezone - IANA timezone identifier
 * @returns Date object representing start of month
 */
export function getMonthStart(date: Date, timezone = 'UTC'): Date {
  const dateStr = formatDateString(date, timezone);
  const [year, month] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Get the last N days as date ranges
 *
 * @param days - Number of days to get (including today)
 * @param options - Date range options (timezone)
 * @returns Array of day ranges, newest first
 */
export function getLastNDays(days: number, options: DateRangeOptions = {}): DayRange[] {
  const { timezone = 'UTC' } = options;
  const result: DayRange[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const dateStr = formatDateString(date, timezone);

    result.push({
      date: dateStr,
      start: getStartOfDay(date, timezone),
      end: getEndOfDay(date, timezone),
    });
  }

  return result;
}

/**
 * Get the last N weeks as date ranges
 *
 * @param weeks - Number of weeks to get (including current week)
 * @param options - Date range options (timezone, weekStartDay)
 * @returns Array of week ranges, newest first
 */
export function getLastNWeeks(weeks: number, options: DateRangeOptions = {}): WeekRange[] {
  const { timezone = 'UTC', weekStartDay = 1 } = options;
  const result: WeekRange[] = [];
  const now = new Date();

  // Find the start of the current week
  const currentWeekStart = getWeekStart(now, weekStartDay, timezone);

  for (let i = 0; i < weeks; i++) {
    const weekStartDate = new Date(currentWeekStart);
    weekStartDate.setDate(weekStartDate.getDate() - i * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const weekStartStr = formatDateString(weekStartDate, timezone);

    result.push({
      weekStart: weekStartStr,
      start: getStartOfDay(weekStartDate, timezone),
      end: getEndOfDay(weekEndDate, timezone),
    });
  }

  return result;
}

/**
 * Get the last N months as date ranges
 *
 * @param months - Number of months to get (including current month)
 * @param options - Date range options (timezone)
 * @returns Array of month ranges, newest first
 */
export function getLastNMonths(months: number, options: DateRangeOptions = {}): MonthRange[] {
  const { timezone = 'UTC' } = options;
  const result: MonthRange[] = [];
  const now = new Date();

  // Find the start of the current month
  const currentMonthStart = getMonthStart(now, timezone);

  for (let i = 0; i < months; i++) {
    const monthStart = new Date(currentMonthStart);
    monthStart.setMonth(monthStart.getMonth() - i);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(monthEnd.getDate() - 1);

    const monthStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

    result.push({
      month: monthStr,
      start: getStartOfDay(monthStart, timezone),
      end: getEndOfDay(monthEnd, timezone),
    });
  }

  return result;
}

/**
 * Get the day of week (0-6) for a given date in the specified timezone
 *
 * @param date - The date to get day of week for
 * @param timezone - IANA timezone identifier
 * @returns Day of week (0=Sunday, 6=Saturday)
 */
export function getDayOfWeek(date: Date, timezone = 'UTC'): DayOfWeek {
  const dateStr = formatDateString(date, timezone);
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  return localDate.getDay() as DayOfWeek;
}

/**
 * Get the hour (0-23) for a given date in the specified timezone
 *
 * @param date - The date to get hour for
 * @param timezone - IANA timezone identifier
 * @returns Hour of day (0-23)
 */
export function getHourOfDay(date: Date, timezone = 'UTC'): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });

  const hour = parseInt(formatter.format(date), 10);
  // Handle midnight edge case (formatted as 24 in some locales)
  return hour === 24 ? 0 : hour;
}

/**
 * Parse an ISO 8601 datetime string and get the hour in the specified timezone
 *
 * @param isoString - ISO 8601 datetime string
 * @param timezone - IANA timezone identifier
 * @returns Hour of day (0-23)
 */
export function getHourFromISOString(isoString: string, timezone = 'UTC'): number {
  const date = new Date(isoString);
  return getHourOfDay(date, timezone);
}

/**
 * Parse an ISO 8601 datetime string and get the day of week in the specified timezone
 *
 * @param isoString - ISO 8601 datetime string
 * @param timezone - IANA timezone identifier
 * @returns Day of week (0=Sunday, 6=Saturday)
 */
export function getDayOfWeekFromISOString(isoString: string, timezone = 'UTC'): DayOfWeek {
  const date = new Date(isoString);
  return getDayOfWeek(date, timezone);
}

/**
 * Calculate hours from seconds
 *
 * @param seconds - Duration in seconds
 * @returns Duration in hours (decimal)
 */
export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

/**
 * Format hours for display
 *
 * @param hours - Duration in hours
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "2.5")
 */
export function formatHours(hours: number, decimals = 1): string {
  return hours.toFixed(decimals);
}

/**
 * Format duration in seconds to HH:MM:SS
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "02:30:45")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}

/**
 * Get the current date string in the specified timezone
 *
 * @param timezone - IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayString(timezone = 'UTC'): string {
  return formatDateString(new Date(), timezone);
}

/**
 * Get ISO week number for a given date
 *
 * @param date - The date to get week number for
 * @returns ISO week number (1-53)
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
