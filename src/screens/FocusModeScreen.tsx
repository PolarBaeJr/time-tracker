/**
 * FocusModeScreen
 *
 * Distraction-free fullscreen view showing only the timer and minimal controls.
 * Requests browser fullscreen on mount (web only) and exits on unmount.
 *
 * Features:
 * - Ambient gradient background animation (subtle hue shift)
 * - Optional breathing animation (inhale 4s, hold 2s, exhale 4s)
 * - Respects reduced motion and animations settings from UX Settings Store
 */

import * as React from 'react';
import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Animated,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { TimerDisplay } from '@/components/timer';
import { Text, Icon } from '@/components/ui';
import { usePomodoro, useKeyboardShortcuts } from '@/hooks';
import { useTimerStore } from '@/stores';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { useTheme } from '@/theme';
import { spacing, fontSizes } from '@/theme';
import { getReducedMotionPreference } from '@/lib/animations';
import type { RootStackScreenProps } from '@/navigation/types';

const PHASE_LABELS = {
  work: 'Focus Time',
  break: 'Short Break',
  long_break: 'Long Break',
} as const;

// ============================================================================
// Breathing Animation Constants
// ============================================================================

/** Breathing animation phases in milliseconds */
const BREATHING_TIMING = {
  inhale: 4000,
  hold: 2000,
  exhale: 4000,
} as const;

/** Breathing scale range */
const BREATHING_SCALE = {
  min: 1.0,
  max: 1.15,
} as const;

// ============================================================================
// Ambient Gradient Component
// ============================================================================

/**
 * HSL color for gradient animation
 */
interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert HSL to CSS string
 */
function hslToString(color: HSLColor): string {
  return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}

/**
 * Gradient hue presets (dark, calming colors)
 */
const GRADIENT_PRESETS = {
  // Dark purple to blue
  default: { start: { h: 260, s: 40, l: 8 }, end: { h: 220, s: 45, l: 12 } },
  // Dark teal to green
  nature: { start: { h: 180, s: 35, l: 8 }, end: { h: 140, s: 40, l: 10 } },
  // Dark red to orange
  warm: { start: { h: 350, s: 40, l: 10 }, end: { h: 20, s: 45, l: 12 } },
} as const;

interface AmbientGradientProps {
  enabled: boolean;
  children: React.ReactNode;
}

/**
 * Animated ambient gradient background
 * Uses CSS animation on web, static gradient on native
 */
function AmbientGradient({ enabled, children }: AmbientGradientProps): React.ReactElement {
  const preset = GRADIENT_PRESETS.default;

  // On web with animations enabled, use CSS animation
  if (Platform.OS === 'web' && enabled) {
    const webStyles: ViewStyle = {
      ...styles.container,
      // @ts-expect-error - Web-specific CSS animation
      background: `linear-gradient(135deg, ${hslToString(preset.start)}, ${hslToString(preset.end)})`,
      backgroundSize: '400% 400%',
      animation: 'gradientShift 20s ease infinite',
    };

    return <View style={webStyles}>{children}</View>;
  }

  // On native or when disabled, use static gradient colors
  return (
    <View style={[styles.container, { backgroundColor: hslToString(preset.start) }]}>
      {children}
    </View>
  );
}

// ============================================================================
// Breathing Indicator Component
// ============================================================================

interface BreathingIndicatorProps {
  enabled: boolean;
  shouldAnimate: boolean;
}

/**
 * Breathing animation indicator
 * Shows a pulsing circle with inhale/hold/exhale phases
 */
function BreathingIndicator({
  enabled,
  shouldAnimate,
}: BreathingIndicatorProps): React.ReactElement | null {
  // Animation values - use useState with lazy initializer
  const [scaleAnim] = useState(() => new Animated.Value(BREATHING_SCALE.min));
  const [opacityAnim] = useState(() => new Animated.Value(0.3));
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');

  // Reset breathing phase when animation is disabled
  useEffect(() => {
    if (!enabled || !shouldAnimate) {
      // Reset to initial state via requestAnimationFrame to avoid synchronous setState
      const frameId = requestAnimationFrame(() => {
        scaleAnim.setValue(BREATHING_SCALE.min);
        opacityAnim.setValue(0.3);
        setBreathingPhase('inhale');
      });
      return () => cancelAnimationFrame(frameId);
    }
    return undefined;
  }, [enabled, shouldAnimate, scaleAnim, opacityAnim]);

  // Start breathing animation when enabled
  useEffect(() => {
    if (!enabled || !shouldAnimate) {
      return;
    }

    let isMounted = true;

    // Create looping breathing animation
    const runBreathingCycle = (): void => {
      if (!isMounted) return;

      // Inhale: scale up, increase opacity
      // Update phase via setTimeout to avoid synchronous setState
      setTimeout(() => {
        if (isMounted) setBreathingPhase('inhale');
      }, 0);
      const inhale = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: BREATHING_SCALE.max,
          duration: BREATHING_TIMING.inhale,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: BREATHING_TIMING.inhale,
          useNativeDriver: true,
        }),
      ]);

      // Hold: maintain position
      const hold = Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: BREATHING_SCALE.max,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(BREATHING_TIMING.hold),
      ]);

      // Exhale: scale down, decrease opacity
      const exhale = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: BREATHING_SCALE.min,
          duration: BREATHING_TIMING.exhale,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: BREATHING_TIMING.exhale,
          useNativeDriver: true,
        }),
      ]);

      // Run the full sequence and loop
      animationRef.current = Animated.sequence([inhale, hold, exhale]);
      animationRef.current.start(({ finished }) => {
        if (finished && isMounted && enabled && shouldAnimate) {
          runBreathingCycle();
        }
      });

      // Update phase labels with timing
      setTimeout(() => {
        if (isMounted) setBreathingPhase('hold');
      }, BREATHING_TIMING.inhale);
      setTimeout(() => {
        if (isMounted) setBreathingPhase('exhale');
      }, BREATHING_TIMING.inhale + BREATHING_TIMING.hold);
    };

    runBreathingCycle();

    return () => {
      isMounted = false;
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [enabled, shouldAnimate, scaleAnim, opacityAnim]);

  if (!enabled) {
    return null;
  }

  const phaseLabel = {
    inhale: 'Breathe in...',
    hold: 'Hold...',
    exhale: 'Breathe out...',
  }[breathingPhase];

  return (
    <View style={styles.breathingContainer}>
      <Animated.View
        style={[
          styles.breathingCircle,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
      <Text style={styles.breathingLabel}>{phaseLabel}</Text>
    </View>
  );
}

// ============================================================================
// Focus Mode Screen
// ============================================================================

export function FocusModeScreen({
  navigation,
}: RootStackScreenProps<'FocusMode'>): React.ReactElement {
  const { colors } = useTheme();
  const activeTimer = useTimerStore(state => state.activeTimer);
  const localElapsed = useTimerStore(state => state.localElapsed);
  const pomodoro = usePomodoro();

  // Get animation settings
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animationsEnabled && !reducedMotion && !getReducedMotionPreference();

  // Breathing animation toggle (could be from settings in the future)
  const [breathingEnabled, setBreathingEnabled] = useState(true);

  const isPomodoroActive = activeTimer?.timer_mode === 'pomodoro';
  const isCountdownActive = activeTimer?.timer_mode === 'countdown';

  const handleExit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggleBreathing = useCallback(() => {
    setBreathingEnabled(prev => !prev);
  }, []);

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

  // Inject CSS animation keyframes on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !shouldAnimate) return;

    const styleId = 'focus-mode-gradient-animation';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, [shouldAnimate]);

  // Escape key to exit
  const shortcuts = useMemo(
    () => [
      {
        id: 'exit-focus-mode',
        key: 'Escape',
        handler: handleExit,
        description: 'Exit focus mode',
      },
      {
        id: 'toggle-breathing',
        key: 'b',
        handler: handleToggleBreathing,
        description: 'Toggle breathing animation',
      },
    ],
    [handleExit, handleToggleBreathing]
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
    <AmbientGradient enabled={shouldAnimate}>
      {/* Exit button - top right */}
      <Pressable
        onPress={handleExit}
        style={styles.exitButton}
        accessibilityRole="button"
        accessibilityLabel="Exit focus mode"
      >
        <Icon name="close" size={24} color="#999" />
      </Pressable>

      {/* Breathing toggle - top left */}
      <Pressable
        onPress={handleToggleBreathing}
        style={styles.breathingToggle}
        accessibilityRole="button"
        accessibilityLabel={breathingEnabled ? 'Disable breathing guide' : 'Enable breathing guide'}
      >
        <Icon
          name={breathingEnabled ? 'eye' : 'eye-off'}
          size={20}
          color={breathingEnabled ? colors.primary : '#666'}
        />
      </Pressable>

      {/* Breathing animation indicator */}
      <BreathingIndicator enabled={breathingEnabled} shouldAnimate={shouldAnimate} />

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
      <Text style={styles.hint}>Press Esc to exit • B to toggle breathing</Text>
    </AmbientGradient>
  );
}

// ============================================================================
// Styles
// ============================================================================

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
  breathingToggle: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    padding: spacing.sm,
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  phaseLabel: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
    textTransform: 'uppercase',
    ...Platform.select({ ios: { letterSpacing: 2 }, default: { letterSpacing: 2 }, android: {} }),
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
  breathingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  breathingCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // primary color with low opacity
    position: 'absolute',
  },
  breathingLabel: {
    position: 'absolute',
    bottom: '30%',
    fontSize: fontSizes.md,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '300',
  },
});

export default FocusModeScreen;
