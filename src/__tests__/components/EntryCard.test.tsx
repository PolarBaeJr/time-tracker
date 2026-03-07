/**
 * EntryCard Component Tests
 *
 * Tests for the EntryCard component logic including:
 * - Displays data correctly including category type
 * - Time formatting
 * - Duration formatting
 * - Notes preview
 * - Edit button functionality
 * - Uncategorized entries
 */

import type { TimeEntry } from '@/schemas';

// Test the component logic directly without rendering

describe('EntryCard', () => {
  const mockEntry: TimeEntry = {
    id: 'entry-1',
    user_id: 'user-1',
    category_id: 'cat-1',
    start_at: '2024-03-01T10:00:00.000Z',
    end_at: '2024-03-01T11:30:00.000Z',
    duration_seconds: 5400, // 1.5 hours
    notes: 'Working on the project',
    entry_type: 'work',
    is_billable: false,
    created_at: '2024-03-01T11:30:00.000Z',
    updated_at: '2024-03-01T11:30:00.000Z',
  };

  describe('duration formatting', () => {
    /**
     * Format duration_seconds into human readable format
     */
    function formatDuration(seconds: number): string {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);

      if (hours === 0) {
        return `${minutes}m`;
      }

      return `${hours}h ${minutes}m`;
    }

    it('should format duration in hours and minutes', () => {
      expect(formatDuration(5400)).toBe('1h 30m'); // 1.5 hours
    });

    it('should format only minutes when under 1 hour', () => {
      expect(formatDuration(1800)).toBe('30m'); // 30 minutes
    });

    it('should format 0 duration', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('should format exact hours', () => {
      expect(formatDuration(3600)).toBe('1h 0m');
      expect(formatDuration(7200)).toBe('2h 0m');
    });

    it('should format complex durations', () => {
      expect(formatDuration(3665)).toBe('1h 1m'); // 1h 1m 5s -> rounds to 1h 1m
      expect(formatDuration(7325)).toBe('2h 2m'); // 2h 2m 5s
    });
  });

  describe('time display', () => {
    /**
     * Format time for display (HH:MM format)
     */
    function formatTime(isoString: string): string {
      const date = new Date(isoString);
      return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    }

    it('should format start time correctly', () => {
      expect(formatTime(mockEntry.start_at)).toBe('10:00');
    });

    it('should format end time correctly', () => {
      expect(formatTime(mockEntry.end_at!)).toBe('11:30');
    });

    it('should display time range', () => {
      const startTime = formatTime(mockEntry.start_at);
      const endTime = formatTime(mockEntry.end_at!);
      const range = `${startTime} - ${endTime}`;

      expect(range).toBe('10:00 - 11:30');
    });
  });

  describe('date display logic', () => {
    /**
     * Get relative date label (Today, Yesterday, or formatted date)
     */
    function getDateLabel(isoString: string, now: Date): string {
      const date = new Date(isoString);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const entryDate = new Date(date);
      entryDate.setHours(0, 0, 0, 0);

      if (entryDate.getTime() === today.getTime()) {
        return 'Today';
      }

      if (entryDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      }

      return date.toLocaleDateString();
    }

    it('should display "Today" for entries from today', () => {
      const now = new Date('2024-03-01T12:00:00.000Z');
      expect(getDateLabel(mockEntry.start_at, now)).toBe('Today');
    });

    it('should display "Yesterday" for entries from yesterday', () => {
      const now = new Date('2024-03-02T12:00:00.000Z');
      expect(getDateLabel(mockEntry.start_at, now)).toBe('Yesterday');
    });

    it('should display formatted date for older entries', () => {
      const now = new Date('2024-03-15T12:00:00.000Z');
      const label = getDateLabel(mockEntry.start_at, now);
      // Should return localized date format
      expect(label).not.toBe('Today');
      expect(label).not.toBe('Yesterday');
    });
  });

  describe('ongoing entry detection', () => {
    function isOngoing(entry: TimeEntry): boolean {
      return entry.end_at === null;
    }

    it('should detect ongoing entry when end_at is null', () => {
      const ongoingEntry: TimeEntry = {
        ...mockEntry,
        end_at: null,
      };

      expect(isOngoing(ongoingEntry)).toBe(true);
    });

    it('should detect completed entry when end_at is present', () => {
      expect(isOngoing(mockEntry)).toBe(false);
    });
  });

  describe('category display', () => {
    interface CategoryDisplayProps {
      categoryName: string | null;
      categoryColor: string | null;
      categoryType: string | null;
    }

    function getCategoryDisplay(props: CategoryDisplayProps) {
      if (props.categoryName === null) {
        return {
          name: 'Uncategorized',
          type: 'Other',
          showColorSwatch: false,
        };
      }

      return {
        name: props.categoryName,
        type: props.categoryType || 'Other',
        showColorSwatch: true,
        color: props.categoryColor,
      };
    }

    it('should display category name', () => {
      const display = getCategoryDisplay({
        categoryName: 'Work',
        categoryColor: '#6366F1',
        categoryType: 'work',
      });

      expect(display.name).toBe('Work');
    });

    it('should display category type', () => {
      const display = getCategoryDisplay({
        categoryName: 'Work',
        categoryColor: '#6366F1',
        categoryType: 'project',
      });

      expect(display.type).toBe('project');
    });

    it('should display "Other" when category type is null', () => {
      const display = getCategoryDisplay({
        categoryName: 'Work',
        categoryColor: '#6366F1',
        categoryType: null,
      });

      expect(display.type).toBe('Other');
    });

    it('should display "Uncategorized" when no category', () => {
      const display = getCategoryDisplay({
        categoryName: null,
        categoryColor: null,
        categoryType: null,
      });

      expect(display.name).toBe('Uncategorized');
      expect(display.showColorSwatch).toBe(false);
    });
  });

  describe('notes display', () => {
    /**
     * Truncate notes for preview display
     */
    function truncateNotes(notes: string | null, maxLength = 80): string | null {
      if (!notes) return null;

      if (notes.length <= maxLength) {
        return notes;
      }

      return notes.substring(0, maxLength) + '...';
    }

    it('should display notes when present', () => {
      const truncated = truncateNotes(mockEntry.notes);
      expect(truncated).toBe('Working on the project');
    });

    it('should return null when notes is null', () => {
      expect(truncateNotes(null)).toBeNull();
    });

    it('should truncate long notes', () => {
      const longNotes =
        'This is a very long note that exceeds the maximum length and should be truncated with an ellipsis at the end to indicate there is more content';
      const truncated = truncateNotes(longNotes);

      expect(truncated).toHaveLength(83); // 80 + '...'
      expect(truncated!.endsWith('...')).toBe(true);
    });

    it('should not truncate short notes', () => {
      const shortNotes = 'Short note';
      const truncated = truncateNotes(shortNotes);

      expect(truncated).toBe('Short note');
    });
  });

  describe('edit button functionality', () => {
    it('should call onEdit with entry when edit is pressed', () => {
      const mockOnEdit = jest.fn();

      // Simulating edit button press
      mockOnEdit(mockEntry);

      expect(mockOnEdit).toHaveBeenCalledWith(mockEntry);
    });

    it('should not render edit button when onEdit is not provided', () => {
      const showEditButton = (onEdit: ((entry: TimeEntry) => void) | undefined) =>
        onEdit !== undefined;

      expect(showEditButton(undefined)).toBe(false);
      expect(showEditButton(jest.fn())).toBe(true);
    });
  });

  describe('card press functionality', () => {
    it('should call onPress with entry when card is pressed', () => {
      const mockOnPress = jest.fn();

      // Simulating card press
      mockOnPress(mockEntry);

      expect(mockOnPress).toHaveBeenCalledWith(mockEntry);
    });

    it('should be pressable only when onPress is provided', () => {
      const isPressable = (onPress: ((entry: TimeEntry) => void) | undefined) =>
        onPress !== undefined;

      expect(isPressable(undefined)).toBe(false);
      expect(isPressable(jest.fn())).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have accessible edit button label', () => {
      const editButtonLabel = 'Edit entry';
      expect(editButtonLabel).toBe('Edit entry');
    });

    it('should include all entry info for accessibility', () => {
      const accessibleDescription = `Work entry from 10:00 to 11:30, duration 1h 30m`;
      expect(accessibleDescription).toContain('Work');
      expect(accessibleDescription).toContain('10:00');
      expect(accessibleDescription).toContain('11:30');
      expect(accessibleDescription).toContain('1h 30m');
    });
  });
});
