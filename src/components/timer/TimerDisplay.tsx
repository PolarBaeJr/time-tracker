/**
 * TimerDisplay Component
 *
 * Displays the elapsed time in a large HH:MM:SS format.
 * Updates every second when timer is running via the timer store.
 *
 * @example
 * ```tsx
 * <TimerDisplay />
 * ```
 */

import * as React from 'react';
import { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useTimerStore } from '@/stores';
import { colors, spacing, fontSizes } from '@/theme';

/**
 * Format seconds into HH:MM:SS display string
 */
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number): string => n.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Props for TimerDisplay component
 */
export interface TimerDisplayProps {
  /** Additional styles for the container */
  style?: ViewStyle;
  /** If set, display countdown from this many seconds remaining instead of elapsed */
  countdownSeconds?: number;
}

/**
 * TimerDisplay Component
 *
 * Shows large formatted time (HH:MM:SS), updates every second.
 * Shows 'No active timer' when idle.
 */
export function TimerDisplay({ style, countdownSeconds }: TimerDisplayProps): React.ReactElement {
  // Get timer state from store - updates every second when running
  const activeTimer = useTimerStore(state => state.activeTimer);
  const localElapsed = useTimerStore(state => state.localElapsed);
  const isRunning = useTimerStore(state => state.isRunning);

  // Format the elapsed time or countdown
  const displayTime = useMemo(() => {
    if (countdownSeconds !== undefined) {
      return formatTime(countdownSeconds);
    }
    return formatTime(localElapsed);
  }, [localElapsed, countdownSeconds]);

  // If no active timer, show idle state
  if (!activeTimer) {
    return (
      <View style={[styles.container, styles.idleContainer, style]}>
        <Text variant="display" style={styles.idleTime}>
          00:00:00
        </Text>
        <Text variant="bodySmall" color="muted" style={styles.statusText}>
          No active timer
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text
        variant="display"
        style={
          StyleSheet.flatten(
            isRunning ? [styles.time, styles.runningTime] : [styles.time]
          ) as TextStyle
        }
      >
        {displayTime}
      </Text>
      <Text variant="bodySmall" color={isRunning ? 'success' : 'warning'} style={styles.statusText}>
        {isRunning ? (countdownSeconds !== undefined ? 'Countdown' : 'Running') : 'Paused'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  idleContainer: {
    opacity: 0.6,
  },
  time: {
    fontSize: fontSizes.display + 16, // Extra large for timer
    fontWeight: '700',
    fontVariant: ['tabular-nums'], // Monospace numbers for stable width
    color: colors.text,
    letterSpacing: 2,
  },
  idleTime: {
    fontSize: fontSizes.display + 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
    letterSpacing: 2,
  },
  runningTime: {
    color: colors.primary,
  },
  statusText: {
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default TimerDisplay;
