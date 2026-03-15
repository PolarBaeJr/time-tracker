/**
 * TimerDisplay Component
 *
 * Displays the elapsed time in a large HH:MM:SS format.
 * Updates every second when timer is running via the timer store.
 *
 * Features:
 * - Subtle pulse animation when timer is running
 * - Color change animation when countdown < 10 seconds
 * - Success celebration animation on phase complete
 * - All animations respect reduced motion settings
 *
 * @example
 * ```tsx
 * <TimerDisplay />
 * ```
 */

import * as React from 'react';
import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Platform, Animated, type ViewStyle, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useTimerStore } from '@/stores';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { colors, spacing, fontSizes, useTheme } from '@/theme';
import { ANIMATION_DURATION, pulse, scale } from '@/lib/animations';

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
  /** When true and countdownSeconds is set, also show elapsed time below */
  showElapsed?: boolean;
  /** Callback when a phase completes (triggers celebration animation) */
  onPhaseComplete?: () => void;
}

/**
 * Warning threshold for countdown (seconds)
 * When countdown is below this, the display pulses in warning color
 */
const COUNTDOWN_WARNING_THRESHOLD = 10;

/**
 * Pulse animation configuration for running state
 */
const RUNNING_PULSE_CONFIG = {
  minScale: 1.0,
  maxScale: 1.01,
  duration: 1500,
};

/**
 * Warning pulse animation configuration (faster, more intense)
 */
const WARNING_PULSE_CONFIG = {
  minScale: 1.0,
  maxScale: 1.02,
  duration: 600,
};

/**
 * TimerDisplay Component
 *
 * Shows large formatted time (HH:MM:SS), updates every second.
 * Shows 'No active timer' when idle.
 *
 * Animation features:
 * - Subtle pulse when running (scale 1.0 to 1.01)
 * - Warning pulse when countdown < 10s (faster, in warning color)
 * - Celebration animation on phase complete (scale pop)
 */
export function TimerDisplay({
  style,
  countdownSeconds,
  showElapsed = false,
  onPhaseComplete,
}: TimerDisplayProps): React.ReactElement {
  const { isDark } = useTheme();

  // Get timer state from store - updates every second when running
  const activeTimer = useTimerStore(state => state.activeTimer);
  const localElapsed = useTimerStore(state => state.localElapsed);
  const isRunning = useTimerStore(state => state.isRunning);

  // Get animation settings
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animationsEnabled && !reducedMotion;

  // Animation values
  const [animatedValues] = useState(() => ({
    scale: new Animated.Value(1),
    celebrationScale: new Animated.Value(1),
  }));

  // Track previous countdown for phase complete detection
  const prevCountdownRef = useRef<number | undefined>(countdownSeconds);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Determine if we're in warning state (countdown < 10 seconds)
  const isWarningState =
    countdownSeconds !== undefined &&
    countdownSeconds <= COUNTDOWN_WARNING_THRESHOLD &&
    countdownSeconds > 0;

  // Format the elapsed time or countdown
  const displayTime = useMemo(() => {
    if (countdownSeconds !== undefined) {
      return formatTime(countdownSeconds);
    }
    return formatTime(localElapsed);
  }, [localElapsed, countdownSeconds]);

  // Handle pulse animation when running
  useEffect(() => {
    if (!shouldAnimate) {
      animatedValues.scale.setValue(1);
      return;
    }

    // Stop any existing pulse animation
    if (pulseAnimationRef.current) {
      pulseAnimationRef.current.stop();
      pulseAnimationRef.current = null;
    }

    if (isRunning) {
      const config = isWarningState ? WARNING_PULSE_CONFIG : RUNNING_PULSE_CONFIG;

      pulseAnimationRef.current = pulse(animatedValues.scale, {
        minScale: config.minScale,
        maxScale: config.maxScale,
        duration: config.duration,
        respectReducedMotion: false, // Already checked above
      });

      pulseAnimationRef.current.start();
    } else {
      // Reset scale when not running
      animatedValues.scale.setValue(1);
    }

    return () => {
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
        pulseAnimationRef.current = null;
      }
    };
  }, [isRunning, isWarningState, shouldAnimate, animatedValues]);

  // Handle celebration animation when phase completes
  useEffect(() => {
    // Check for phase completion inside the effect (not during render)
    const prevCountdown = prevCountdownRef.current;
    const phaseJustCompleted =
      prevCountdown !== undefined && prevCountdown > 0 && countdownSeconds === 0;

    if (phaseJustCompleted && shouldAnimate) {
      // Celebration: quick scale up then back down
      Animated.sequence([
        scale(animatedValues.celebrationScale, 1.1, {
          duration: ANIMATION_DURATION.fast,
          easing: 'spring',
          respectReducedMotion: false,
        }),
        scale(animatedValues.celebrationScale, 1, {
          duration: ANIMATION_DURATION.normal,
          easing: 'easeOut',
          respectReducedMotion: false,
        }),
      ]).start();

      // Call the callback if provided
      onPhaseComplete?.();
    }

    // Update ref for next comparison
    prevCountdownRef.current = countdownSeconds;
  }, [countdownSeconds, shouldAnimate, animatedValues, onPhaseComplete]);

  // Get colors based on state
  const getTimeColor = useCallback((): string => {
    if (!activeTimer) {
      return colors.textMuted;
    }
    if (isWarningState) {
      return isDark ? '#F87171' : '#DC2626'; // Error/warning red
    }
    if (isRunning) {
      return colors.primary;
    }
    return colors.text;
  }, [activeTimer, isWarningState, isRunning, isDark]);

  // Get status text color
  const getStatusColor = useCallback((): 'success' | 'warning' | 'error' | 'muted' => {
    if (isWarningState) {
      return 'error';
    }
    if (isRunning) {
      return 'success';
    }
    return 'warning';
  }, [isWarningState, isRunning]);

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

  // Combine scale transforms
  const animatedStyle = shouldAnimate
    ? {
        transform: [{ scale: animatedValues.scale }, { scale: animatedValues.celebrationScale }],
      }
    : undefined;

  const timeTextStyle: TextStyle = {
    ...styles.time,
    color: getTimeColor(),
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={animatedStyle}>
        <Text variant="display" style={StyleSheet.flatten(timeTextStyle) as TextStyle}>
          {displayTime}
        </Text>
      </Animated.View>
      <Text variant="bodySmall" color={getStatusColor()} style={styles.statusText}>
        {isWarningState
          ? 'Almost done!'
          : isRunning
            ? countdownSeconds !== undefined
              ? 'Countdown'
              : 'Running'
            : 'Paused'}
      </Text>
      {showElapsed && countdownSeconds !== undefined && (
        <Text variant="body" color="muted" style={styles.elapsedText}>
          Elapsed: {formatTime(localElapsed)}
        </Text>
      )}
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
    ...Platform.select({ ios: { letterSpacing: 2 }, default: { letterSpacing: 2 }, android: {} }),
  },
  idleTime: {
    fontSize: fontSizes.display + 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
    ...Platform.select({ ios: { letterSpacing: 2 }, default: { letterSpacing: 2 }, android: {} }),
  },
  statusText: {
    fontSize: 14,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    ...Platform.select({ ios: { letterSpacing: 1 }, default: { letterSpacing: 1 }, android: {} }),
  },
  elapsedText: {
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
});

export default TimerDisplay;
