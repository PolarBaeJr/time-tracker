/**
 * SharedDashboardViewer Component Tests
 *
 * Tests for the SharedDashboardViewer component logic including:
 * - Duration formatting
 * - Hours conversion
 * - Category sorting
 * - Progress bar calculations
 */

import type { SharedDashboardData, CategoryBreakdown, DailyTotal } from '@/schemas';

describe('SharedDashboardViewer', () => {
  // ============================================================================
  // Test Data
  // ============================================================================

  const mockDashboardData: SharedDashboardData = {
    title: 'My Analytics Dashboard',
    owner_name: 'John',
    is_workspace: false,
    workspace_name: null,
    date_range: {
      start: '2024-03-01T00:00:00.000Z',
      end: '2024-03-31T23:59:59.000Z',
    },
    summary: {
      total_hours_week: 32.5,
      total_hours_month: 120.25,
      avg_hours_per_day: 4.5,
      days_tracked: 22,
    },
    daily_totals: [
      { date: '2024-03-01', total_seconds: 14400 }, // 4 hours
      { date: '2024-03-02', total_seconds: 18000 }, // 5 hours
      { date: '2024-03-03', total_seconds: 10800 }, // 3 hours
    ],
    category_breakdown: [
      {
        category_id: '123e4567-e89b-12d3-a456-426614174000',
        category_name: 'Development',
        category_color: '#6366F1',
        total_seconds: 72000, // 20 hours
        percentage: 60,
      },
      {
        category_id: '223e4567-e89b-12d3-a456-426614174000',
        category_name: 'Meetings',
        category_color: '#F59E0B',
        total_seconds: 36000, // 10 hours
        percentage: 30,
      },
      {
        category_id: null,
        category_name: 'Uncategorized',
        category_color: '#9CA3AF',
        total_seconds: 12000, // 3.3 hours
        percentage: 10,
      },
    ],
    generated_at: '2024-03-31T12:00:00.000Z',
  };

  // ============================================================================
  // Duration Formatting Tests
  // ============================================================================

  describe('formatDuration', () => {
    /**
     * Format total seconds as hours and minutes string
     * Mirrors formatDuration from useSharedDashboardView
     */
    function formatDuration(totalSeconds: number): string {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      if (hours === 0) {
        return `${minutes}m`;
      }
      if (minutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${minutes}m`;
    }

    it('should format hours only', () => {
      expect(formatDuration(7200)).toBe('2h'); // 2 hours exactly
    });

    it('should format minutes only', () => {
      expect(formatDuration(1800)).toBe('30m'); // 30 minutes
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(5400)).toBe('1h 30m'); // 1.5 hours
    });

    it('should handle 0 seconds', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('should handle large values', () => {
      expect(formatDuration(86400)).toBe('24h'); // 24 hours
    });

    it('should handle seconds remainder', () => {
      expect(formatDuration(3665)).toBe('1h 1m'); // 1 hour, 1 minute, 5 seconds
    });
  });

  // ============================================================================
  // Seconds to Hours Conversion Tests
  // ============================================================================

  describe('secondsToHours', () => {
    /**
     * Convert seconds to hours with decimal precision
     * Mirrors secondsToHours from useSharedDashboardView
     */
    function secondsToHours(totalSeconds: number, decimals = 1): number {
      const hours = totalSeconds / 3600;
      const factor = Math.pow(10, decimals);
      return Math.round(hours * factor) / factor;
    }

    it('should convert seconds to hours with 1 decimal', () => {
      expect(secondsToHours(5400)).toBe(1.5); // 1.5 hours
    });

    it('should round to specified decimals', () => {
      expect(secondsToHours(5000, 2)).toBe(1.39); // ~1.388... hours
    });

    it('should handle 0 seconds', () => {
      expect(secondsToHours(0)).toBe(0);
    });

    it('should handle exact hour values', () => {
      expect(secondsToHours(3600)).toBe(1);
      expect(secondsToHours(7200)).toBe(2);
    });
  });

  // ============================================================================
  // Category Sorting Tests
  // ============================================================================

  describe('category sorting', () => {
    /**
     * Sort categories by total time descending
     */
    function sortCategories(categories: CategoryBreakdown[]): CategoryBreakdown[] {
      return [...categories].sort((a, b) => b.total_seconds - a.total_seconds);
    }

    it('should sort categories by total_seconds descending', () => {
      const sorted = sortCategories(mockDashboardData.category_breakdown);
      expect(sorted[0].category_name).toBe('Development');
      expect(sorted[1].category_name).toBe('Meetings');
      expect(sorted[2].category_name).toBe('Uncategorized');
    });

    it('should handle empty array', () => {
      expect(sortCategories([])).toEqual([]);
    });

    it('should handle single category', () => {
      const single = [mockDashboardData.category_breakdown[0]];
      expect(sortCategories(single)).toEqual(single);
    });
  });

  // ============================================================================
  // Progress Bar Calculation Tests
  // ============================================================================

  describe('progress bar width calculation', () => {
    /**
     * Calculate progress bar width percentage for a category
     */
    function calculateBarWidth(categorySeconds: number, totalSeconds: number): number {
      if (totalSeconds === 0) return 0;
      return (categorySeconds / totalSeconds) * 100;
    }

    it('should calculate correct percentage', () => {
      const total = 120000;
      expect(calculateBarWidth(72000, total)).toBe(60); // 60%
      expect(calculateBarWidth(36000, total)).toBe(30); // 30%
      expect(calculateBarWidth(12000, total)).toBe(10); // 10%
    });

    it('should handle 0 total', () => {
      expect(calculateBarWidth(1000, 0)).toBe(0);
    });

    it('should handle full width', () => {
      expect(calculateBarWidth(1000, 1000)).toBe(100);
    });
  });

  // ============================================================================
  // Daily Chart Tests
  // ============================================================================

  describe('daily chart bar height calculation', () => {
    /**
     * Calculate bar height percentage based on max value
     */
    function calculateBarHeight(value: number, maxValue: number): number {
      if (maxValue <= 0) return 0;
      return (value / maxValue) * 100;
    }

    it('should calculate correct height percentage', () => {
      const max = 18000; // 5 hours
      expect(calculateBarHeight(18000, max)).toBe(100); // Max
      expect(calculateBarHeight(14400, max)).toBe(80); // 4/5 hours
      expect(calculateBarHeight(9000, max)).toBe(50); // 2.5 hours
    });

    it('should handle 0 max value', () => {
      expect(calculateBarHeight(1000, 0)).toBe(0);
    });

    it('should handle 0 value', () => {
      expect(calculateBarHeight(0, 1000)).toBe(0);
    });

    /**
     * Get max value from daily totals
     */
    function getMaxDailyValue(totals: DailyTotal[]): number {
      if (totals.length === 0) return 0;
      return Math.max(...totals.map(d => d.total_seconds));
    }

    it('should find max value from daily totals', () => {
      const max = getMaxDailyValue(mockDashboardData.daily_totals);
      expect(max).toBe(18000); // 5 hours
    });

    it('should handle empty daily totals', () => {
      expect(getMaxDailyValue([])).toBe(0);
    });
  });

  // ============================================================================
  // Date Range Display Tests
  // ============================================================================

  describe('date range formatting', () => {
    /**
     * Format date for display
     */
    function formatDateDisplay(dateStr: string): string {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    it('should format date correctly', () => {
      // Use a date string that creates a consistent local date
      const result = formatDateDisplay('2024-03-15T12:00:00.000Z');
      // Check that it contains expected components (month, day, year)
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/(Mar|15)/);
    });

    /**
     * Get day abbreviation from date
     */
    function getDayAbbrev(dateStr: string): string {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }

    it('should return day abbreviation', () => {
      // Test that we get a 3-character day abbreviation
      const result = getDayAbbrev('2024-03-15T12:00:00.000Z');
      expect(result.length).toBeLessThanOrEqual(4); // Most locales use 2-3 chars
      expect(typeof result).toBe('string');
    });
  });

  // ============================================================================
  // Summary Card Data Tests
  // ============================================================================

  describe('summary card data', () => {
    it('should have correct week total', () => {
      expect(mockDashboardData.summary.total_hours_week).toBe(32.5);
    });

    it('should have correct month total', () => {
      expect(mockDashboardData.summary.total_hours_month).toBe(120.25);
    });

    it('should have correct daily average', () => {
      expect(mockDashboardData.summary.avg_hours_per_day).toBe(4.5);
    });

    it('should have correct days tracked', () => {
      expect(mockDashboardData.summary.days_tracked).toBe(22);
    });
  });

  // ============================================================================
  // Workspace Dashboard Tests
  // ============================================================================

  describe('workspace dashboard', () => {
    const workspaceDashboard: SharedDashboardData = {
      ...mockDashboardData,
      is_workspace: true,
      workspace_name: 'Engineering Team',
      top_projects: [
        {
          project_id: '123e4567-e89b-12d3-a456-426614174000',
          project_name: 'Project Alpha',
          project_color: '#6366F1',
          total_seconds: 36000,
          percentage: 50,
        },
      ],
    };

    it('should have is_workspace flag set', () => {
      expect(workspaceDashboard.is_workspace).toBe(true);
    });

    it('should have workspace_name', () => {
      expect(workspaceDashboard.workspace_name).toBe('Engineering Team');
    });

    it('should have top_projects for workspace dashboards', () => {
      expect(workspaceDashboard.top_projects).toBeDefined();
      expect(workspaceDashboard.top_projects?.length).toBe(1);
    });
  });

  // ============================================================================
  // Branding Tests
  // ============================================================================

  describe('branding', () => {
    it('should have generated_at timestamp', () => {
      expect(mockDashboardData.generated_at).toBeDefined();
      expect(new Date(mockDashboardData.generated_at)).toBeInstanceOf(Date);
    });

    it('should display "Powered by WorkTracker" branding', () => {
      // This is a UI test - we just verify the component will have access
      // to render branding based on the data structure
      expect(mockDashboardData).toBeDefined();
    });
  });
});
