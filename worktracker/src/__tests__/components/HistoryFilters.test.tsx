/**
 * HistoryFilters Component Tests
 *
 * Tests for the HistoryFilters component including:
 * - Filter changes propagate correctly
 * - Date range filtering
 * - Category filtering
 * - Duration filtering
 * - Search functionality
 * - Clear filters
 */

import * as React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import type { TimeEntryFilters, Category } from '@/schemas';

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
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fontSizes: {
    sm: 12,
    md: 14,
  },
  borderRadius: {
    md: 8,
    xl: 16,
    full: 999,
  },
}));

// Mock the UI components
jest.mock('@/components/ui', () => ({
  Button: ({
    children,
    onPress,
    disabled,
    variant,
    style,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    variant?: string;
    style?: object;
  }) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      { onPress, disabled, style, testID: `button-${variant || 'default'}` },
      typeof children === 'string'
        ? React.createElement(Text, null, children)
        : children
    );
  },
  Text: ({
    children,
    variant,
    style,
  }: {
    children: React.ReactNode;
    variant?: string;
    style?: object;
  }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { style }, children);
  },
  Input: ({
    value,
    onChangeText,
    placeholder,
    disabled,
    label,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
  }) => {
    const React = require('react');
    const { View, Text, TextInput } = require('react-native');
    return React.createElement(
      View,
      null,
      label && React.createElement(Text, null, label),
      React.createElement(TextInput, {
        value,
        onChangeText,
        placeholder,
        editable: !disabled,
        testID: `input-${placeholder || 'default'}`,
      })
    );
  },
  Card: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  },
  Icon: ({ name, size, color }: { name: string; size: number; color: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: `icon-${name}` }, name);
  },
}));

describe('HistoryFilters', () => {
  const mockOnFiltersChange = jest.fn();

  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      user_id: 'user-1',
      name: 'Work',
      color: '#6366F1',
      type: 'work',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'cat-2',
      user_id: 'user-1',
      name: 'Study',
      color: '#10B981',
      type: 'education',
      created_at: '2024-01-01T00:00:00.000Z',
    },
  ];

  const emptyFilters: TimeEntryFilters = {};

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('expand/collapse', () => {
    it('should render collapsed by default', () => {
      const { getByText, queryByText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      expect(getByText('Filters')).toBeTruthy();
      // Search placeholder should not be visible when collapsed
      expect(queryByText('From')).toBeNull();
    });

    it('should expand when header is pressed', () => {
      const { getByText, getByLabelText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByText('From')).toBeTruthy();
      expect(getByText('To')).toBeTruthy();
      expect(getByText('Category')).toBeTruthy();
      expect(getByText('Duration')).toBeTruthy();
    });

    it('should collapse when header is pressed again', () => {
      const { getByText, queryByText, getByLabelText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand
      fireEvent.press(getByLabelText('Expand filters'));
      expect(getByText('From')).toBeTruthy();

      // Collapse
      fireEvent.press(getByLabelText('Collapse filters'));
      expect(queryByText('From')).toBeNull();
    });
  });

  describe('active filters indicator', () => {
    it('should not show indicator when no filters active', () => {
      const { queryByTestId } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // The active indicator is a small dot - we check for its absence
      expect(queryByTestId('active-indicator')).toBeNull();
    });
  });

  describe('search notes', () => {
    it('should update filters when search text changes (after debounce)', async () => {
      const { getByLabelText, getByPlaceholderText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      // Type in search
      const searchInput = getByPlaceholderText('Search notes...');
      fireEvent.changeText(searchInput, 'project');

      // Advance timers to trigger debounce
      act(() => {
        jest.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({
            searchNotes: 'project',
          })
        );
      });
    });
  });

  describe('date range filtering', () => {
    it('should update dateStart when valid date is entered', () => {
      const { getByLabelText, getByTestId } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      // Enter date
      const fromInput = getByTestId('input-YYYY-MM-DD');
      fireEvent.changeText(fromInput, '2024-03-01');

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dateStart: '2024-03-01T00:00:00Z',
        })
      );
    });

    it('should clear dateStart when input is cleared', () => {
      const filtersWithDate: TimeEntryFilters = {
        dateStart: '2024-03-01T00:00:00Z',
      };

      const { getByLabelText, getByTestId } = render(
        <HistoryFilters
          filters={filtersWithDate}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      // Clear date
      const fromInput = getByTestId('input-YYYY-MM-DD');
      fireEvent.changeText(fromInput, '');

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dateStart: undefined,
        })
      );
    });
  });

  describe('duration filtering', () => {
    it('should render duration presets', () => {
      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByText('Any')).toBeTruthy();
      expect(getByText('< 30m')).toBeTruthy();
      expect(getByText('30m - 1h')).toBeTruthy();
      expect(getByText('1h - 2h')).toBeTruthy();
    });

    it('should update filters when duration preset is selected', () => {
      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      // Select "< 30m" preset
      fireEvent.press(getByText('< 30m'));

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minDuration: undefined,
          maxDuration: 1800,
        })
      );
    });

    it('should select 1h - 2h duration preset', () => {
      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      // Select "1h - 2h" preset
      fireEvent.press(getByText('1h - 2h'));

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minDuration: 3600,
          maxDuration: 7200,
        })
      );
    });
  });

  describe('category filtering', () => {
    it('should show category selector button', () => {
      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByText('All Categories')).toBeTruthy();
    });

    it('should show selected category name', () => {
      const filtersWithCategory: TimeEntryFilters = {
        categoryId: 'cat-1',
      };

      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={filtersWithCategory}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByText('Work')).toBeTruthy();
    });

    it('should show "Uncategorized" when categoryId is null', () => {
      const filtersWithUncategorized: TimeEntryFilters = {
        categoryId: null,
      };

      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={filtersWithUncategorized}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByText('Uncategorized')).toBeTruthy();
    });
  });

  describe('clear filters', () => {
    it('should show clear button when filters are active', () => {
      const activeFilters: TimeEntryFilters = {
        categoryId: 'cat-1',
        minDuration: 3600,
      };

      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={activeFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByText('Clear All Filters')).toBeTruthy();
    });

    it('should clear all filters when clear button is pressed', () => {
      const activeFilters: TimeEntryFilters = {
        categoryId: 'cat-1',
        minDuration: 3600,
        searchNotes: 'test',
      };

      const { getByLabelText, getByText } = render(
        <HistoryFilters
          filters={activeFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      // Clear filters
      fireEvent.press(getByText('Clear All Filters'));

      expect(mockOnFiltersChange).toHaveBeenCalledWith({});
    });

    it('should not show clear button when no filters are active', () => {
      const { getByLabelText, queryByText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(queryByText('Clear All Filters')).toBeNull();
    });
  });

  describe('disabled state', () => {
    it('should disable all controls when disabled prop is true', () => {
      const { getByLabelText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
          disabled={true}
        />
      );

      // Header should be disabled
      const header = getByLabelText('Expand filters');
      expect(header.props.disabled).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have accessible expand/collapse button', () => {
      const { getByLabelText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      expect(getByLabelText('Expand filters')).toBeTruthy();
    });

    it('should have accessible category selector', () => {
      const { getByLabelText } = render(
        <HistoryFilters
          filters={emptyFilters}
          onFiltersChange={mockOnFiltersChange}
          categories={mockCategories}
        />
      );

      // Expand filters
      fireEvent.press(getByLabelText('Expand filters'));

      expect(getByLabelText('Select category filter')).toBeTruthy();
    });
  });
});
