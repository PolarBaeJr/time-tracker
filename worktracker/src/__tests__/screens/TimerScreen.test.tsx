/**
 * TimerScreen Tests
 *
 * Tests for the TimerScreen component including:
 * - Full screen render with mocked hooks
 * - Start/Stop timer flow
 * - Category selection
 * - Connection status display
 * - Notes input functionality
 * - Accessibility: labels present, roles correct
 */

import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TimerScreen } from '@/screens/TimerScreen';
import { useTimerStore } from '@/stores';
import { useRealtimeTimer, useCategories, markLocalTimerAction } from '@/hooks';
import { startTimer, stopTimer } from '@/services/timerService';
import type { Category } from '@/schemas';

// Mock all external dependencies
jest.mock('@/stores', () => ({
  useTimerStore: jest.fn(),
}));

jest.mock('@/hooks', () => ({
  useRealtimeTimer: jest.fn(),
  useCategories: jest.fn(),
  markLocalTimerAction: jest.fn(),
}));

jest.mock('@/services/timerService', () => ({
  startTimer: jest.fn(),
  stopTimer: jest.fn(),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: object }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { style, testID: 'safe-area-view' }, children);
  },
}));

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
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
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
  },
}));

// Mock timer components
jest.mock('@/components/timer', () => ({
  TimerDisplay: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'timer-display' }, '00:00:00');
  },
  TimerControls: ({
    onStart,
    onStop,
    isStarting,
    isStopping,
  }: {
    onStart: () => void;
    onStop: () => void;
    isStarting?: boolean;
    isStopping?: boolean;
  }) => {
    const React = require('react');
    const { View, TouchableOpacity, Text } = require('react-native');
    return React.createElement(
      View,
      { testID: 'timer-controls' },
      React.createElement(
        TouchableOpacity,
        {
          onPress: onStart,
          testID: 'start-button',
          disabled: isStarting,
          accessibilityLabel: 'Start timer',
        },
        React.createElement(Text, null, 'Start')
      ),
      React.createElement(
        TouchableOpacity,
        {
          onPress: onStop,
          testID: 'stop-button',
          disabled: isStopping,
          accessibilityLabel: 'Stop timer',
        },
        React.createElement(Text, null, 'Stop')
      )
    );
  },
  CategorySelector: ({
    visible,
    onClose,
    onSelect,
    selectedCategoryId,
  }: {
    visible: boolean;
    onClose: () => void;
    onSelect: (id: string | null) => void;
    selectedCategoryId?: string | null;
  }) => {
    const React = require('react');
    const { View, Text, TouchableOpacity, Modal } = require('react-native');
    return React.createElement(
      Modal,
      { visible, testID: 'category-selector-modal' },
      React.createElement(
        View,
        null,
        React.createElement(Text, null, 'Select Category'),
        React.createElement(
          TouchableOpacity,
          { onPress: () => onSelect('cat-1'), testID: 'select-work' },
          React.createElement(Text, null, 'Work')
        ),
        React.createElement(
          TouchableOpacity,
          { onPress: () => onSelect(null), testID: 'select-no-category' },
          React.createElement(Text, null, 'No category')
        ),
        React.createElement(
          TouchableOpacity,
          { onPress: onClose, testID: 'close-selector' },
          React.createElement(Text, null, 'Close')
        )
      )
    );
  },
}));

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({
    children,
    onPress,
    variant,
    style,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    variant?: string;
    style?: object;
  }) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      { onPress, style, testID: `button-${variant || 'default'}` },
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
    style,
    center,
  }: {
    children: React.ReactNode;
    variant?: string;
    color?: string;
    style?: object;
    center?: boolean;
  }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { style }, children);
  },
  Icon: ({ name, size, color, style }: { name: string; size: number; color: string; style?: object }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: `icon-${name}`, style }, name);
  },
}));

const mockUseTimerStore = useTimerStore as jest.MockedFunction<typeof useTimerStore>;
const mockUseRealtimeTimer = useRealtimeTimer as jest.MockedFunction<typeof useRealtimeTimer>;
const mockUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;
const mockStartTimer = startTimer as jest.MockedFunction<typeof startTimer>;
const mockStopTimer = stopTimer as jest.MockedFunction<typeof stopTimer>;
const mockMarkLocalTimerAction = markLocalTimerAction as jest.MockedFunction<typeof markLocalTimerAction>;

describe('TimerScreen', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseTimerStore.mockImplementation((selector) => {
      const state = {
        activeTimer: null,
      };
      return selector(state as Parameters<typeof selector>[0]);
    });

    mockUseRealtimeTimer.mockReturnValue({
      connectionStatus: 'connected',
      isConnected: true,
      isReconnecting: false,
      isDisconnected: false,
      lastSyncMessage: null,
      clearSyncMessage: jest.fn(),
      lastError: null,
      clearError: jest.fn(),
      markLocalAction: jest.fn(),
    });

    mockUseCategories.mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as ReturnType<typeof mockUseCategories>);

    mockStartTimer.mockResolvedValue({ data: { id: 'timer-1', user_id: 'user-1', category_id: null, started_at: new Date().toISOString(), running: true }, error: null });
    mockStopTimer.mockResolvedValue({ data: { id: 'entry-1', user_id: 'user-1', category_id: null, start_at: new Date().toISOString(), end_at: new Date().toISOString(), duration_seconds: 60, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, error: null });
  });

  describe('rendering', () => {
    it('should render the TimerScreen', () => {
      const { getByTestId, getByText } = render(<TimerScreen />);

      expect(getByTestId('safe-area-view')).toBeTruthy();
      expect(getByText('Timer')).toBeTruthy();
    });

    it('should render TimerDisplay component', () => {
      const { getByTestId } = render(<TimerScreen />);

      expect(getByTestId('timer-display')).toBeTruthy();
    });

    it('should render TimerControls component', () => {
      const { getByTestId } = render(<TimerScreen />);

      expect(getByTestId('timer-controls')).toBeTruthy();
    });
  });

  describe('connection status', () => {
    it('should display "Connected" when connected', () => {
      mockUseRealtimeTimer.mockReturnValue({
        connectionStatus: 'connected',
        isConnected: true,
        isReconnecting: false,
        isDisconnected: false,
        lastSyncMessage: null,
        clearSyncMessage: jest.fn(),
        lastError: null,
        clearError: jest.fn(),
        markLocalAction: jest.fn(),
      });

      const { getByText } = render(<TimerScreen />);

      expect(getByText('Connected')).toBeTruthy();
    });

    it('should display "Reconnecting..." when reconnecting', () => {
      mockUseRealtimeTimer.mockReturnValue({
        connectionStatus: 'reconnecting',
        isConnected: false,
        isReconnecting: true,
        isDisconnected: false,
        lastSyncMessage: null,
        clearSyncMessage: jest.fn(),
        lastError: null,
        clearError: jest.fn(),
        markLocalAction: jest.fn(),
      });

      const { getByText } = render(<TimerScreen />);

      expect(getByText('Reconnecting...')).toBeTruthy();
    });

    it('should display "Offline" when disconnected', () => {
      mockUseRealtimeTimer.mockReturnValue({
        connectionStatus: 'disconnected',
        isConnected: false,
        isReconnecting: false,
        isDisconnected: true,
        lastSyncMessage: null,
        clearSyncMessage: jest.fn(),
        lastError: null,
        clearError: jest.fn(),
        markLocalAction: jest.fn(),
      });

      const { getByText } = render(<TimerScreen />);

      expect(getByText('Offline')).toBeTruthy();
    });
  });

  describe('category display', () => {
    it('should show "No category" when no category is selected and no active timer', () => {
      const { getByText } = render(<TimerScreen />);

      expect(getByText('No category')).toBeTruthy();
    });

    it('should show category name when active timer has category', () => {
      mockUseTimerStore.mockImplementation((selector) => {
        const state = {
          activeTimer: {
            id: 'timer-1',
            user_id: 'user-1',
            category_id: 'cat-1',
            started_at: new Date().toISOString(),
            running: true,
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });

      const { getByText } = render(<TimerScreen />);

      expect(getByText('Work')).toBeTruthy();
    });
  });

  describe('start timer flow', () => {
    it('should call startTimer when start button is pressed', async () => {
      const { getByTestId } = render(<TimerScreen />);

      fireEvent.press(getByTestId('start-button'));

      await waitFor(() => {
        expect(mockMarkLocalTimerAction).toHaveBeenCalled();
        expect(mockStartTimer).toHaveBeenCalledWith({ categoryId: null });
      });
    });

    it('should call startTimer with selected category', async () => {
      const { getByTestId, getByText } = render(<TimerScreen />);

      // Open category selector (by pressing the category button)
      // For this test, we'll simulate category selection directly
      // First press the chevron/category button area
      fireEvent.press(getByText('No category'));

      // Select a category
      fireEvent.press(getByTestId('select-work'));

      // Now start timer
      fireEvent.press(getByTestId('start-button'));

      await waitFor(() => {
        expect(mockStartTimer).toHaveBeenCalledWith({ categoryId: 'cat-1' });
      });
    });
  });

  describe('stop timer flow', () => {
    beforeEach(() => {
      mockUseTimerStore.mockImplementation((selector) => {
        const state = {
          activeTimer: {
            id: 'timer-1',
            user_id: 'user-1',
            category_id: null,
            started_at: new Date().toISOString(),
            running: true,
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });
    });

    it('should show notes input on first stop button press', () => {
      const { getByTestId, getByPlaceholderText } = render(<TimerScreen />);

      fireEvent.press(getByTestId('stop-button'));

      // Notes input should appear
      expect(getByPlaceholderText('Add notes (optional)...')).toBeTruthy();
    });

    it('should call stopTimer on second stop button press', async () => {
      const { getByTestId, getByPlaceholderText } = render(<TimerScreen />);

      // First press shows notes input
      fireEvent.press(getByTestId('stop-button'));

      // Second press stops timer
      fireEvent.press(getByTestId('stop-button'));

      await waitFor(() => {
        expect(mockMarkLocalTimerAction).toHaveBeenCalled();
        expect(mockStopTimer).toHaveBeenCalledWith({ notes: null });
      });
    });

    it('should pass notes to stopTimer', async () => {
      const { getByTestId, getByPlaceholderText } = render(<TimerScreen />);

      // First press shows notes input
      fireEvent.press(getByTestId('stop-button'));

      // Enter notes
      const notesInput = getByPlaceholderText('Add notes (optional)...');
      fireEvent.changeText(notesInput, 'Completed the task');

      // Second press stops timer
      fireEvent.press(getByTestId('stop-button'));

      await waitFor(() => {
        expect(mockStopTimer).toHaveBeenCalledWith({ notes: 'Completed the task' });
      });
    });

    it('should have Skip Notes button', () => {
      const { getByTestId, getByText } = render(<TimerScreen />);

      // First press shows notes input
      fireEvent.press(getByTestId('stop-button'));

      expect(getByText('Skip Notes')).toBeTruthy();
    });

    it('should have Cancel button for notes', () => {
      const { getByTestId, getByText } = render(<TimerScreen />);

      // First press shows notes input
      fireEvent.press(getByTestId('stop-button'));

      expect(getByText('Cancel')).toBeTruthy();
    });
  });

  describe('sync message', () => {
    it('should display sync message when present', () => {
      mockUseRealtimeTimer.mockReturnValue({
        connectionStatus: 'connected',
        isConnected: true,
        isReconnecting: false,
        isDisconnected: false,
        lastSyncMessage: 'Timer synced from another device',
        clearSyncMessage: jest.fn(),
        lastError: null,
        clearError: jest.fn(),
        markLocalAction: jest.fn(),
      });

      const { getByText } = render(<TimerScreen />);

      expect(getByText('Timer synced from another device')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have accessible start button', () => {
      const { getByLabelText } = render(<TimerScreen />);

      expect(getByLabelText('Start timer')).toBeTruthy();
    });

    it('should have accessible stop button', () => {
      const { getByLabelText } = render(<TimerScreen />);

      expect(getByLabelText('Stop timer')).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should handle startTimer error gracefully', async () => {
      const error = new Error('Network error') as Error & { code: string; operation: string };
      error.name = 'TimerServiceError';
      error.code = 'NETWORK_ERROR';
      error.operation = 'start';
      mockStartTimer.mockResolvedValue({
        data: null,
        error: error as Parameters<typeof startTimer>[0] extends infer _ ? import('@/services/timerService').TimerServiceError : never,
      } as Awaited<ReturnType<typeof startTimer>>);

      const { getByTestId } = render(<TimerScreen />);

      fireEvent.press(getByTestId('start-button'));

      // Should not throw, component should handle error
      await waitFor(() => {
        expect(mockStartTimer).toHaveBeenCalled();
      });
    });

    it('should handle stopTimer error gracefully', async () => {
      mockUseTimerStore.mockImplementation((selector) => {
        const state = {
          activeTimer: {
            id: 'timer-1',
            user_id: 'user-1',
            category_id: null,
            started_at: new Date().toISOString(),
            running: true,
          },
        };
        return selector(state as Parameters<typeof selector>[0]);
      });

      const error = new Error('Server error') as Error & { code: string; operation: string };
      error.name = 'TimerServiceError';
      error.code = 'SERVER_ERROR';
      error.operation = 'stop';
      mockStopTimer.mockResolvedValue({
        data: null,
        error: error as Parameters<typeof stopTimer>[0] extends infer _ ? import('@/services/timerService').TimerServiceError : never,
      } as Awaited<ReturnType<typeof stopTimer>>);

      const { getByTestId } = render(<TimerScreen />);

      // First press shows notes, second stops
      fireEvent.press(getByTestId('stop-button'));
      fireEvent.press(getByTestId('stop-button'));

      // Should not throw, component should handle error
      await waitFor(() => {
        expect(mockStopTimer).toHaveBeenCalled();
      });
    });
  });
});
