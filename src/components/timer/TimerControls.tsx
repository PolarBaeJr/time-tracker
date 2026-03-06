/**
 * TimerControls Component
 *
 * Provides Start/Stop buttons with proper disabled states based on timer status.
 * Handles the timer lifecycle including starting, stopping, and category selection.
 *
 * @example
 * ```tsx
 * <TimerControls
 *   onStart={handleStart}
 *   onStop={handleStop}
 *   isStarting={isStarting}
 *   isStopping={isStopping}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { useTimerStore } from '@/stores';
import { colors, spacing } from '@/theme';

/**
 * Props for TimerControls component
 */
export interface TimerControlsProps {
  /** Callback when start button is pressed */
  onStart: () => void;
  /** Callback when stop button is pressed */
  onStop: () => void;
  /** Whether a start operation is in progress */
  isStarting?: boolean;
  /** Whether a stop operation is in progress */
  isStopping?: boolean;
  /** Whether the controls are disabled (e.g., during loading) */
  disabled?: boolean;
  /** Additional styles for the container */
  style?: ViewStyle;
}

/**
 * TimerControls Component
 *
 * Shows Start button when no timer is active, Stop button when timer is running.
 * Includes loading and disabled states for pending operations.
 */
export function TimerControls({
  onStart,
  onStop,
  isStarting = false,
  isStopping = false,
  disabled = false,
  style,
}: TimerControlsProps): React.ReactElement {
  // Get timer state from store
  const activeTimer = useTimerStore((state) => state.activeTimer);

  // Determine if timer is active
  const hasActiveTimer = activeTimer !== null;

  // If no active timer, show Start button
  if (!hasActiveTimer) {
    return (
      <View style={[styles.container, style]}>
        <Button
          variant="primary"
          size="lg"
          onPress={onStart}
          loading={isStarting}
          disabled={disabled || isStarting}
          style={styles.mainButton}
          accessibilityLabel="Start timer"
          accessibilityHint="Double tap to start tracking time"
        >
          <View style={styles.buttonContent}>
            <Icon name="play" size={24} color={colors.text} />
            <View style={styles.buttonTextContainer}>
              {!isStarting && (
                <View style={styles.startText}>
                  <Icon name="play" size={0} color="transparent" />
                </View>
              )}
            </View>
          </View>
        </Button>
      </View>
    );
  }

  // Timer is active - show Stop button
  return (
    <View style={[styles.container, style]}>
      <Button
        variant="danger"
        size="lg"
        onPress={onStop}
        loading={isStopping}
        disabled={disabled || isStopping}
        style={styles.mainButton}
        accessibilityLabel="Stop timer"
        accessibilityHint="Double tap to stop tracking time and save entry"
      >
        <View style={styles.buttonContent}>
          <Icon name="stop" size={24} color={colors.text} />
        </View>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  mainButton: {
    minWidth: 160,
    paddingVertical: spacing.md,
    borderRadius: 999, // Pill shape
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default TimerControls;
