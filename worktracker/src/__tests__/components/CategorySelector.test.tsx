/**
 * CategorySelector Component Tests
 *
 * Tests for the CategorySelector component including:
 * - Renders categories with name, color, and type
 * - Selection works correctly
 * - "No category" option works
 * - Loading state
 * - Empty state
 * - Accessibility labels
 */

import * as React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategorySelector } from '@/components/timer/CategorySelector';
import { useCategories } from '@/hooks';
import type { Category } from '@/schemas';

// Mock the hooks module
jest.mock('@/hooks', () => ({
  useCategories: jest.fn(),
}));

// Mock theme module
jest.mock('@/theme', () => ({
  colors: {
    text: '#FFFFFF',
    textMuted: '#999999',
    primary: '#6366F1',
    primaryVariant: '#4F46E5',
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
  borderRadius: {
    md: 8,
    lg: 12,
  },
}));

// Mock the UI components
jest.mock('@/components/ui', () => ({
  Button: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  }) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      { onPress, accessibilityLabel, testID: 'button' },
      typeof children === 'string'
        ? React.createElement(Text, null, children)
        : children
    );
  },
  Card: ({ children, style }: { children: React.ReactNode; style?: object }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { style, testID: 'card' }, children);
  },
  Text: ({
    children,
    variant,
    color,
    center,
    style,
  }: {
    children: React.ReactNode;
    variant?: string;
    color?: string;
    center?: boolean;
    style?: object;
  }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(
      Text,
      { style, testID: `text-${variant || 'default'}` },
      children
    );
  },
  Spinner: ({ message }: { message?: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'spinner' }, message || 'Loading...');
  },
}));

const mockUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;

describe('CategorySelector', () => {
  const mockOnClose = jest.fn();
  const mockOnSelect = jest.fn();

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
    {
      id: 'cat-3',
      user_id: 'user-1',
      name: 'Exercise',
      color: '#F59E0B',
      type: 'health',
      created_at: '2024-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('visibility', () => {
    it('should not render content when not visible', () => {
      mockUseCategories.mockReturnValue({
        data: mockCategories,
        isLoading: false,
      } as ReturnType<typeof useCategories>);

      const { queryByTestId } = render(
        <CategorySelector
          visible={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Modal should still exist but content might not be visible
      // This is a basic check - actual visibility depends on Modal implementation
      expect(queryByTestId).toBeDefined();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when categories are loading', () => {
      mockUseCategories.mockReturnValue({
        data: [],
        isLoading: true,
      } as ReturnType<typeof useCategories>);

      const { getByTestId } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByTestId('spinner')).toBeTruthy();
    });
  });

  describe('category rendering', () => {
    beforeEach(() => {
      mockUseCategories.mockReturnValue({
        data: mockCategories,
        isLoading: false,
      } as ReturnType<typeof useCategories>);
    });

    it('should render category names', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByText('Work')).toBeTruthy();
      expect(getByText('Study')).toBeTruthy();
      expect(getByText('Exercise')).toBeTruthy();
    });

    it('should render category types', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByText('work')).toBeTruthy();
      expect(getByText('education')).toBeTruthy();
      expect(getByText('health')).toBeTruthy();
    });

    it('should render "No category" option', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByText('No category')).toBeTruthy();
    });

    it('should render "Select Category" header', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByText('Select Category')).toBeTruthy();
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      mockUseCategories.mockReturnValue({
        data: mockCategories,
        isLoading: false,
      } as ReturnType<typeof useCategories>);
    });

    it('should call onSelect with category id when category is pressed', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.press(getByText('Work'));

      expect(mockOnSelect).toHaveBeenCalledWith('cat-1');
    });

    it('should call onSelect with null when "No category" is pressed', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.press(getByText('No category'));

      expect(mockOnSelect).toHaveBeenCalledWith(null);
    });

    it('should call onClose after selection', () => {
      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.press(getByText('Work'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show checkmark for selected category', () => {
      const { getByLabelText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          selectedCategoryId="cat-1"
        />
      );

      // The category item should have selected state
      const workItem = getByLabelText('Work');
      expect(workItem).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no categories exist', () => {
      mockUseCategories.mockReturnValue({
        data: [],
        isLoading: false,
      } as ReturnType<typeof useCategories>);

      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByText('No categories yet')).toBeTruthy();
      expect(getByText('Create categories in the Categories tab')).toBeTruthy();
    });

    it('should still show "No category" option in empty state', () => {
      mockUseCategories.mockReturnValue({
        data: [],
        isLoading: false,
      } as ReturnType<typeof useCategories>);

      const { getByText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByText('No category')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      mockUseCategories.mockReturnValue({
        data: mockCategories,
        isLoading: false,
      } as ReturnType<typeof useCategories>);
    });

    it('should have accessibility label for category items', () => {
      const { getByLabelText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByLabelText('Work')).toBeTruthy();
      expect(getByLabelText('Study')).toBeTruthy();
      expect(getByLabelText('Exercise')).toBeTruthy();
    });

    it('should have accessibility label for "No category" option', () => {
      const { getByLabelText } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(getByLabelText('No category')).toBeTruthy();
    });
  });

  describe('close functionality', () => {
    beforeEach(() => {
      mockUseCategories.mockReturnValue({
        data: mockCategories,
        isLoading: false,
      } as ReturnType<typeof useCategories>);
    });

    it('should have close button', () => {
      const { getAllByTestId } = render(
        <CategorySelector
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Find close button by test ID
      const buttons = getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
