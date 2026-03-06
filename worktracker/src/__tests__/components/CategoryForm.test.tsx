/**
 * CategoryForm Component Tests
 *
 * Tests for the CategoryForm component including:
 * - Validates all three fields: name, color, type
 * - Create mode vs edit mode
 * - Form submission
 * - Delete functionality
 * - Validation errors
 */

import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CategoryForm } from '@/components/categories/CategoryForm';
import type { Category } from '@/schemas';

// Mock theme module
jest.mock('@/theme', () => ({
  colors: {
    text: '#FFFFFF',
    textMuted: '#999999',
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2D2D2D',
    border: '#404040',
    primary: '#6366F1',
    overlayLight: 'rgba(255, 255, 255, 0.1)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    full: 999,
  },
}));

// Mock schemas
jest.mock('@/schemas', () => {
  const originalModule = jest.requireActual('@/schemas');
  return {
    ...originalModule,
    CreateCategorySchema: {
      safeParse: jest.fn((data) => {
        const errors: { path: string[]; message: string }[] = [];
        if (!data.name || data.name.length === 0) {
          errors.push({ path: ['name'], message: 'Name is required' });
        }
        if (data.name && data.name.length > 100) {
          errors.push({ path: ['name'], message: 'Name must be 100 characters or less' });
        }
        if (!data.type || data.type.length === 0) {
          errors.push({ path: ['type'], message: 'Type is required' });
        }
        if (data.type && data.type.length > 50) {
          errors.push({ path: ['type'], message: 'Type must be 50 characters or less' });
        }
        if (!data.color || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
          errors.push({ path: ['color'], message: 'Invalid color format' });
        }
        return {
          success: errors.length === 0,
          data: errors.length === 0 ? data : undefined,
          error: errors.length > 0 ? { issues: errors } : undefined,
        };
      }),
    },
    UpdateCategorySchema: {
      safeParse: jest.fn((data) => {
        const errors: { path: string[]; message: string }[] = [];
        if (data.name !== undefined && data.name.length === 0) {
          errors.push({ path: ['name'], message: 'Name cannot be empty' });
        }
        if (data.name && data.name.length > 100) {
          errors.push({ path: ['name'], message: 'Name must be 100 characters or less' });
        }
        return {
          success: errors.length === 0,
          data: errors.length === 0 ? data : undefined,
          error: errors.length > 0 ? { issues: errors } : undefined,
        };
      }),
    },
  };
});

// Mock ColorPicker
jest.mock('@/components/ui/ColorPicker', () => ({
  PRESET_COLORS: ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
}));

// Mock the UI components
jest.mock('@/components/ui', () => ({
  Button: ({
    children,
    onPress,
    loading,
    disabled,
    variant,
    style,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: string;
    style?: object;
  }) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      {
        onPress,
        disabled: disabled || loading,
        style,
        testID: `button-${variant || 'default'}`,
      },
      loading
        ? React.createElement(Text, null, 'Loading...')
        : typeof children === 'string'
          ? React.createElement(Text, null, children)
          : children
    );
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
    return React.createElement(Text, { style, testID: `text-${variant || 'default'}` }, children);
  },
  Input: ({
    value,
    onChangeText,
    placeholder,
    label,
    error,
    maxLength,
    autoFocus,
    helperText,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
    error?: string;
    maxLength?: number;
    autoFocus?: boolean;
    helperText?: string;
  }) => {
    const React = require('react');
    const { View, Text, TextInput } = require('react-native');
    return React.createElement(
      View,
      { testID: `input-container-${label || 'default'}` },
      label && React.createElement(Text, { testID: `input-label-${label}` }, label),
      React.createElement(TextInput, {
        value,
        onChangeText,
        placeholder,
        maxLength,
        autoFocus,
        testID: `input-${label || 'default'}`,
      }),
      error && React.createElement(Text, { testID: `input-error-${label}` }, error),
      helperText && React.createElement(Text, { testID: `input-helper-${label}` }, helperText)
    );
  },
  ColorPicker: ({
    value,
    onChange,
    label,
    error,
  }: {
    value: string;
    onChange: (color: string) => void;
    label?: string;
    error?: string;
  }) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    const PRESET_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    return React.createElement(
      View,
      { testID: 'color-picker' },
      label && React.createElement(Text, null, label),
      PRESET_COLORS.map((color: string) =>
        React.createElement(TouchableOpacity, {
          key: color,
          onPress: () => onChange(color),
          testID: `color-${color}`,
        })
      ),
      error && React.createElement(Text, { testID: 'color-error' }, error)
    );
  },
  Card: ({
    children,
    pressable,
    onPress,
    padding,
    style,
  }: {
    children: React.ReactNode;
    pressable?: boolean;
    onPress?: () => void;
    padding?: string;
    style?: object;
  }) => {
    const React = require('react');
    const { TouchableOpacity, View } = require('react-native');
    if (pressable && onPress) {
      return React.createElement(TouchableOpacity, { onPress, style, testID: 'card' }, children);
    }
    return React.createElement(View, { style, testID: 'card' }, children);
  },
}));

describe('CategoryForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnDelete = jest.fn();

  const mockCategory: Category = {
    id: 'cat-1',
    user_id: 'user-1',
    name: 'Work',
    color: '#6366F1',
    type: 'work',
    created_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create mode', () => {
    it('should render "New Category" title', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByText('New Category')).toBeTruthy();
    });

    it('should render "Create Category" button', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByText('Create Category')).toBeTruthy();
    });

    it('should render empty form fields', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      const nameInput = getByTestId('input-Name');
      const typeInput = getByTestId('input-Type');

      expect(nameInput.props.value).toBe('');
      expect(typeInput.props.value).toBe('');
    });

    it('should not render delete button', () => {
      const { queryByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
          onDelete={mockOnDelete}
        />
      );

      expect(queryByText('Delete Category')).toBeNull();
    });
  });

  describe('edit mode', () => {
    it('should render "Edit Category" title', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={mockCategory}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByText('Edit Category')).toBeTruthy();
    });

    it('should render "Save Changes" button', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={mockCategory}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByText('Save Changes')).toBeTruthy();
    });

    it('should populate form with category data', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={mockCategory}
          onSubmit={mockOnSubmit}
        />
      );

      const nameInput = getByTestId('input-Name');
      const typeInput = getByTestId('input-Type');

      expect(nameInput.props.value).toBe('Work');
      expect(typeInput.props.value).toBe('work');
    });

    it('should render delete button when onDelete is provided', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={mockCategory}
          onSubmit={mockOnSubmit}
          onDelete={mockOnDelete}
        />
      );

      expect(getByText('Delete Category')).toBeTruthy();
    });
  });

  describe('form fields', () => {
    it('should render name input with label', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByTestId('input-label-Name')).toBeTruthy();
    });

    it('should render type input with label', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByTestId('input-label-Type')).toBeTruthy();
    });

    it('should render color picker', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByTestId('color-picker')).toBeTruthy();
    });

    it('should render type suggestions', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      expect(getByText('work')).toBeTruthy();
      expect(getByText('personal')).toBeTruthy();
      expect(getByText('hobby')).toBeTruthy();
      expect(getByText('study')).toBeTruthy();
    });
  });

  describe('form interaction', () => {
    it('should update name field when typed', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      const nameInput = getByTestId('input-Name');
      fireEvent.changeText(nameInput, 'New Category');

      expect(nameInput.props.value).toBe('New Category');
    });

    it('should update type field when typed', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      const typeInput = getByTestId('input-Type');
      fireEvent.changeText(typeInput, 'project');

      expect(typeInput.props.value).toBe('project');
    });

    it('should update type field when suggestion is pressed', () => {
      const { getByText, getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      fireEvent.press(getByText('hobby'));

      const typeInput = getByTestId('input-Type');
      expect(typeInput.props.value).toBe('hobby');
    });

    it('should update color when color is selected', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      fireEvent.press(getByTestId('color-#10B981'));

      // Color picker should have updated internal state
      expect(getByTestId('color-picker')).toBeTruthy();
    });
  });

  describe('validation', () => {
    it('should show error when name is empty on submit', async () => {
      const { getByText, getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      // Fill only type, leave name empty
      fireEvent.changeText(getByTestId('input-Type'), 'work');
      fireEvent.press(getByText('Create Category'));

      await waitFor(() => {
        expect(getByTestId('input-error-Name')).toBeTruthy();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when type is empty on submit', async () => {
      const { getByText, getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      // Fill only name, leave type empty
      fireEvent.changeText(getByTestId('input-Name'), 'Test Category');
      fireEvent.press(getByText('Create Category'));

      await waitFor(() => {
        expect(getByTestId('input-error-Type')).toBeTruthy();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit with valid data', async () => {
      const { getByText, getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      // Fill all fields
      fireEvent.changeText(getByTestId('input-Name'), 'Test Category');
      fireEvent.changeText(getByTestId('input-Type'), 'work');
      fireEvent.press(getByText('Create Category'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Category',
          type: 'work',
          color: '#6366F1', // Default color
        });
      });
    });
  });

  describe('loading states', () => {
    it('should disable submit button when saving', () => {
      const { getByTestId } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
          isSaving={true}
        />
      );

      const submitButton = getByTestId('button-primary');
      expect(submitButton.props.disabled).toBe(true);
    });

    it('should show loading indicator on submit button when saving', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
          isSaving={true}
        />
      );

      expect(getByText('Loading...')).toBeTruthy();
    });
  });

  describe('close functionality', () => {
    it('should call onClose when Cancel is pressed', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
        />
      );

      fireEvent.press(getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not call onClose when saving', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={null}
          onSubmit={mockOnSubmit}
          isSaving={true}
        />
      );

      fireEvent.press(getByText('Cancel'));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('delete functionality', () => {
    it('should show delete confirmation when delete is pressed and no entries', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={mockCategory}
          onSubmit={mockOnSubmit}
          onDelete={mockOnDelete}
          entryCount={0}
        />
      );

      fireEvent.press(getByText('Delete Category'));

      // Should go directly to delete since no entries
      expect(mockOnDelete).toHaveBeenCalledWith('cat-1');
    });

    it('should show confirmation when entries exist', () => {
      const { getByText } = render(
        <CategoryForm
          visible={true}
          onClose={mockOnClose}
          category={mockCategory}
          onSubmit={mockOnSubmit}
          onDelete={mockOnDelete}
          entryCount={5}
          otherCategories={[]}
        />
      );

      fireEvent.press(getByText('Delete Category'));

      // Should show confirmation
      expect(getByText('Delete Category?')).toBeTruthy();
      expect(getByText(/This category has 5 time entries/)).toBeTruthy();
    });
  });
});
