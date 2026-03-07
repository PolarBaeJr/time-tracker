/**
 * FocusModeScreen
 *
 * Distraction-free fullscreen view showing only the timer and minimal controls.
 * Requests browser fullscreen on mount (web only) and exits on unmount.
 */

import * as React from 'react';
import { useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform, Pressable, type TextStyle } from 'react-native';

import { TimerDisplay } from '@/components/timer';
import { Text, Icon } from '@/components/ui';
import { usePomodoro, useKeyboardShortcuts } from '@/hooks';
import { useTimerStore } from '@/stores';
import { useTheme } from '@/theme';
import { spacing, fontSizes } from '@/theme';
import type { RootStackScreenProps } from '@/navigation/types';

const PHASE_LABELS = {
  work: 'Focus Time',
  break: 'Short Break',
  long_break: 'Long Break',
} as const;

export function FocusModeScreen({
  navigation,
}: RootStackScreenProps<'FocusMode'>): React.ReactElement {
  const { colors } = useTheme();
  const activeTimer = useTimerStore(state => state.activeTimer);
  const localElapsed = useTimerStore(state => state.localElapsed);
  const pomodoro = usePomodoro();

  const isPomodoroActive = activeTimer?.timer_mode === 'pomodoro';
  const isCountdownActive = activeTimer?.timer_mode === 'countdown';

  const handleExit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Request fullscreen on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    try {
      document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen API may not be available
    }

    return () => {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        }
      } catch {
        // Ignore errors on cleanup
      }
    };
  }, []);

  // Escape key to exit
  const shortcuts = useMemo(
    () => [
      {
        id: 'exit-focus-mode',
        key: 'Escape',
        handler: handleExit,
        description: 'Exit focus mode',
      },
    ],
    [handleExit]
  );

  useKeyboardShortcuts(shortcuts);

  // Countdown remaining seconds
  const countdownRemaining = useMemo(() => {
    if (!isCountdownActive || !activeTimer?.phase_duration_seconds) return undefined;
    return Math.max(0, activeTimer.phase_duration_seconds - localElapsed);
  }, [isCountdownActive, activeTimer, localElapsed]);

  // If timer stops while in focus mode, exit
  useEffect(() => {
    if (!activeTimer) {
      navigation.goBack();
    }
  }, [activeTimer, navigation]);

  return (
    <View style={styles.container}>
      {/* Exit button - top right */}
      <Pressable
        onPress={handleExit}
        style={styles.exitButton}
        accessibilityRole="button"
        accessibilityLabel="Exit focus mode"
      >
        <Icon name="close" size={24} color="#999" />
      </Pressable>

      {/* Centered content */}
      <View style={styles.content}>
        {/* Pomodoro phase label */}
        {isPomodoroActive && (
          <Text
            style={StyleSheet.flatten([styles.phaseLabel, { color: colors.primary }]) as TextStyle}
          >
            {PHASE_LABELS[pomodoro.currentPhase]}
          </Text>
        )}

        {/* Timer display */}
        <TimerDisplay
          countdownSeconds={
            isPomodoroActive
              ? pomodoro.timeRemainingSeconds
              : isCountdownActive
                ? countdownRemaining
                : undefined
          }
          showElapsed={isPomodoroActive || isCountdownActive}
        />

        {/* Pomodoro progress */}
        {isPomodoroActive && (
          <Text style={styles.pomodoroProgress}>
            {pomodoro.pomodorosCompleted} / {pomodoro.settings.pomodorosBeforeLongBreak} pomodoros
          </Text>
        )}
      </View>

      {/* Bottom hint */}
      <Text style={styles.hint}>Press Esc to exit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.sm,
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  pomodoroProgress: {
    fontSize: fontSizes.sm,
    color: '#666',
    marginTop: spacing.sm,
  },
  hint: {
    position: 'absolute',
    bottom: spacing.lg,
    fontSize: fontSizes.xs,
    color: '#444',
  },
});

export default FocusModeScreen;
