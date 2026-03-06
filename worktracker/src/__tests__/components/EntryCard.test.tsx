/**
 * EntryCard Component Tests
 *
 * Tests for the EntryCard component including:
 * - Displays data correctly including category type
 * - Time formatting
 * - Duration formatting
 * - Notes preview
 * - Edit button functionality
 * - Uncategorized entries
 */

import * as React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EntryCard } from '@/components/history/EntryCard';
import type { TimeEntry } from '@/schemas';

// Mock theme module
jest.mock('@/theme', () => ({
  colors: {
    text: '#FFFFFF',
    textMuted: '#999999',
    textSecondary: '#AAAAAA',
    primary: '#6366F1',
    surface: '#1E1E1E',
    surfaceVariant: '#2D2D2D',
    border: '#404040',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  },
  fontSizes: {
    xs: 10,
    sm: 12,
    md: 14,
  },
  borderRadius: {
    sm: 4,
    md: 8,
  },
}));

// Mock the UI components
jest.mock('@/components/ui', () => ({
  Card: ({
    children,
    onPress,
    pressable,
    padding,
    elevation,
    style,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    pressable?: boolean;
    padding?: string;
    elevation?: string;
    style?: object;
  }) => {
    const React = require('react');
    const { TouchableOpacity, View } = require('react-native');
    if (pressable && onPress) {
      return React.createElement(
        TouchableOpacity,
        { onPress, style, testID: 'entry-card' },
        children
      );
    }
    return React.createElement(View, { style, testID: 'entry-card' }, children);
  },
  Text: ({
    children,
    style,
    numberOfLines,
  }: {
    children: React.ReactNode;
    style?: object;
    numberOfLines?: number;
  }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { style, numberOfLines }, children);
  },
  Icon: ({ name, size, color }: { name: string; size: number; color: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: `icon-${name}` }, name);
  },
}));

describe('EntryCard', () => {
  const mockOnEdit = jest.fn();
  const mockOnPress = jest.fn();

  const mockEntry: TimeEntry = {
    id: 'entry-1',
    user_id: 'user-1',
    category_id: 'cat-1',
    start_at: '2024-03-01T10:00:00.000Z',
    end_at: '2024-03-01T11:30:00.000Z',
    duration_seconds: 5400, // 1.5 hours
    notes: 'Working on the project',
    created_at: '2024-03-01T11:30:00.000Z',
    updated_at: '2024-03-01T11:30:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date for consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-03-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('category display', () => {
    it('should display category name', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('Work')).toBeTruthy();
    });

    it('should display category type', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="project"
        />
      );

      expect(getByText('project')).toBeTruthy();
    });

    it('should display "Other" when category type is null', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType={null}
        />
      );

      expect(getByText('Other')).toBeTruthy();
    });

    it('should display "Uncategorized" when no category', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName={null}
          categoryColor={null}
          categoryType={null}
        />
      );

      expect(getByText('Uncategorized')).toBeTruthy();
    });
  });

  describe('time display', () => {
    it('should display "Today" for entries from today', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('Today')).toBeTruthy();
    });

    it('should display "Yesterday" for entries from yesterday', () => {
      const yesterdayEntry: TimeEntry = {
        ...mockEntry,
        start_at: '2024-02-29T10:00:00.000Z',
        end_at: '2024-02-29T11:30:00.000Z',
      };

      const { getByText } = render(
        <EntryCard
          entry={yesterdayEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('Yesterday')).toBeTruthy();
    });

    it('should display "Ongoing" when end_at is null', () => {
      const ongoingEntry: TimeEntry = {
        ...mockEntry,
        end_at: null,
      };

      const { getByText } = render(
        <EntryCard
          entry={ongoingEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('Ongoing')).toBeTruthy();
    });
  });

  describe('duration display', () => {
    it('should display duration in hours and minutes', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('1h 30m')).toBeTruthy();
    });

    it('should display only minutes when under 1 hour', () => {
      const shortEntry: TimeEntry = {
        ...mockEntry,
        duration_seconds: 1800, // 30 minutes
      };

      const { getByText } = render(
        <EntryCard
          entry={shortEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('30m')).toBeTruthy();
    });

    it('should display 0m for zero duration', () => {
      const zeroEntry: TimeEntry = {
        ...mockEntry,
        duration_seconds: 0,
      };

      const { getByText } = render(
        <EntryCard
          entry={zeroEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('0m')).toBeTruthy();
    });
  });

  describe('notes display', () => {
    it('should display notes when present', () => {
      const { getByText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(getByText('Working on the project')).toBeTruthy();
    });

    it('should not display notes section when notes is null', () => {
      const noNotesEntry: TimeEntry = {
        ...mockEntry,
        notes: null,
      };

      const { queryByText } = render(
        <EntryCard
          entry={noNotesEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(queryByText('Working on the project')).toBeNull();
    });

    it('should truncate long notes', () => {
      const longNotesEntry: TimeEntry = {
        ...mockEntry,
        notes:
          'This is a very long note that exceeds the maximum length and should be truncated with an ellipsis at the end to indicate there is more content',
      };

      const { getByText } = render(
        <EntryCard
          entry={longNotesEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      // Should contain ellipsis
      const truncatedText = 'This is a very long note that exceeds the maximum length and should be truncated...';
      expect(getByText(truncatedText)).toBeTruthy();
    });
  });

  describe('edit button', () => {
    it('should render edit button when onEdit is provided', () => {
      const { getByTestId } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
          onEdit={mockOnEdit}
        />
      );

      expect(getByTestId('icon-edit')).toBeTruthy();
    });

    it('should not render edit button when onEdit is not provided', () => {
      const { queryByTestId } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      expect(queryByTestId('icon-edit')).toBeNull();
    });

    it('should call onEdit with entry when edit button is pressed', () => {
      const { getByLabelText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
          onEdit={mockOnEdit}
        />
      );

      fireEvent.press(getByLabelText('Edit entry'));

      expect(mockOnEdit).toHaveBeenCalledWith(mockEntry);
    });
  });

  describe('card press', () => {
    it('should call onPress with entry when card is pressed', () => {
      const { getByTestId } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
          onPress={mockOnPress}
        />
      );

      fireEvent.press(getByTestId('entry-card'));

      expect(mockOnPress).toHaveBeenCalledWith(mockEntry);
    });

    it('should not be pressable when onPress is not provided', () => {
      const { getByTestId } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
        />
      );

      const card = getByTestId('entry-card');
      // Card should still render but not be pressable
      expect(card).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have accessible edit button', () => {
      const { getByLabelText } = render(
        <EntryCard
          entry={mockEntry}
          categoryName="Work"
          categoryColor="#6366F1"
          categoryType="work"
          onEdit={mockOnEdit}
        />
      );

      expect(getByLabelText('Edit entry')).toBeTruthy();
    });
  });
});
