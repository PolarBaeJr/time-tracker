/**
 * Core animation infrastructure for the application
 *
 * Provides utility functions for common animations (fade, scale, slide, pulse)
 * using React Native's Animated API without external dependencies.
 *
 * All animations respect the prefers-reduced-motion setting.
 */

import { Animated, Easing, Platform } from 'react-native';

/**
 * Animation duration presets in milliseconds
 */
export const ANIMATION_DURATION = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
} as const;

export type AnimationDuration = keyof typeof ANIMATION_DURATION;

/**
 * Easing function type (React Native Animated)
 */
export type EasingFunction = (value: number) => number;

/**
 * Animation easing presets
 */
export const ANIMATION_EASING: Record<string, EasingFunction> = {
  linear: Easing.linear,
  easeIn: Easing.ease,
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),
  bounce: Easing.bounce,
  spring: Easing.bezier(0.175, 0.885, 0.32, 1.275),
  elastic: Easing.elastic(1),
};

export type AnimationEasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce'
  | 'spring'
  | 'elastic';

/**
 * Configuration options for animations
 */
export interface AnimationConfig {
  /** Duration in ms or duration preset name */
  duration?: number | AnimationDuration;
  /** Delay before animation starts in ms */
  delay?: number;
  /** Easing function or preset name */
  easing?: AnimationEasingName | EasingFunction;
  /** Use native driver for better performance (default: true) */
  useNativeDriver?: boolean;
  /** Whether to respect reduced motion preference (default: true) */
  respectReducedMotion?: boolean;
}

/**
 * Default animation configuration
 */
const DEFAULT_CONFIG: Required<AnimationConfig> = {
  duration: 250,
  delay: 0,
  easing: 'easeOut',
  useNativeDriver: true,
  respectReducedMotion: true,
};

/**
 * Check if reduced motion is preferred by the user.
 * On web, checks the prefers-reduced-motion media query.
 * On native, this should be synced with AccessibilityInfo (handled by useReducedMotion hook).
 */
let _reducedMotionPreference: boolean | null = null;

/**
 * Get the current reduced motion preference
 */
export function getReducedMotionPreference(): boolean {
  if (_reducedMotionPreference !== null) {
    return _reducedMotionPreference;
  }

  // On web, check the media query
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    _reducedMotionPreference = mediaQuery.matches;

    // Listen for changes
    mediaQuery.addEventListener('change', e => {
      _reducedMotionPreference = e.matches;
    });

    return _reducedMotionPreference;
  }

  // Default to false on native (will be synced by useReducedMotion)
  return false;
}

/**
 * Set the reduced motion preference (used by useReducedMotion hook)
 */
export function setReducedMotionPreference(value: boolean): void {
  _reducedMotionPreference = value;
}

/**
 * Resolves duration from number or preset name
 */
function resolveDuration(duration: number | AnimationDuration): number {
  if (typeof duration === 'number') {
    return duration;
  }
  return ANIMATION_DURATION[duration];
}

/**
 * Resolves easing from function or preset name
 */
function resolveEasing(easing: AnimationEasingName | EasingFunction): EasingFunction {
  if (typeof easing === 'function') {
    return easing;
  }
  return ANIMATION_EASING[easing] ?? ANIMATION_EASING.easeOut;
}

/**
 * Merges config with defaults and handles reduced motion
 */
function resolveConfig(config?: AnimationConfig): Required<AnimationConfig> & {
  resolvedDuration: number;
  resolvedEasing: EasingFunction;
} {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const shouldReduceMotion = merged.respectReducedMotion && getReducedMotionPreference();

  return {
    ...merged,
    resolvedDuration: shouldReduceMotion ? 0 : resolveDuration(merged.duration),
    resolvedEasing: resolveEasing(merged.easing),
  };
}

/**
 * Creates a fade animation (opacity transition)
 *
 * @param value - Animated.Value to animate
 * @param toValue - Target opacity (0 to 1)
 * @param config - Animation configuration
 * @returns Animated.CompositeAnimation
 */
export function fade(
  value: Animated.Value,
  toValue: number,
  config?: AnimationConfig
): Animated.CompositeAnimation {
  const resolved = resolveConfig(config);

  if (resolved.resolvedDuration === 0) {
    return Animated.timing(value, {
      toValue,
      duration: 0,
      useNativeDriver: resolved.useNativeDriver,
    });
  }

  return Animated.timing(value, {
    toValue,
    duration: resolved.resolvedDuration,
    delay: resolved.delay,
    easing: resolved.resolvedEasing,
    useNativeDriver: resolved.useNativeDriver,
  });
}

/**
 * Creates a fade in animation (opacity 0 -> 1)
 */
export function fadeIn(
  value: Animated.Value,
  config?: AnimationConfig
): Animated.CompositeAnimation {
  value.setValue(0);
  return fade(value, 1, config);
}

/**
 * Creates a fade out animation (opacity 1 -> 0)
 */
export function fadeOut(
  value: Animated.Value,
  config?: AnimationConfig
): Animated.CompositeAnimation {
  value.setValue(1);
  return fade(value, 0, config);
}

/**
 * Creates a scale animation
 *
 * @param value - Animated.Value to animate
 * @param toValue - Target scale
 * @param config - Animation configuration
 * @returns Animated.CompositeAnimation
 */
export function scale(
  value: Animated.Value,
  toValue: number,
  config?: AnimationConfig
): Animated.CompositeAnimation {
  const resolved = resolveConfig(config);

  if (resolved.resolvedDuration === 0) {
    return Animated.timing(value, {
      toValue,
      duration: 0,
      useNativeDriver: resolved.useNativeDriver,
    });
  }

  return Animated.timing(value, {
    toValue,
    duration: resolved.resolvedDuration,
    delay: resolved.delay,
    easing: resolved.resolvedEasing,
    useNativeDriver: resolved.useNativeDriver,
  });
}

/**
 * Creates a scale in animation (0 -> 1) with optional overshoot
 */
export function scaleIn(
  value: Animated.Value,
  config?: AnimationConfig & { overshoot?: boolean }
): Animated.CompositeAnimation {
  value.setValue(0);
  const easing = config?.overshoot ? 'spring' : (config?.easing ?? 'easeOut');
  return scale(value, 1, { ...config, easing });
}

/**
 * Creates a scale out animation (1 -> 0)
 */
export function scaleOut(
  value: Animated.Value,
  config?: AnimationConfig
): Animated.CompositeAnimation {
  value.setValue(1);
  return scale(value, 0, config);
}

/**
 * Creates a slide animation
 *
 * @param value - Animated.Value to animate (represents translation)
 * @param toValue - Target translation
 * @param config - Animation configuration
 * @returns Animated.CompositeAnimation
 */
export function slide(
  value: Animated.Value,
  toValue: number,
  config?: AnimationConfig
): Animated.CompositeAnimation {
  const resolved = resolveConfig(config);

  if (resolved.resolvedDuration === 0) {
    return Animated.timing(value, {
      toValue,
      duration: 0,
      useNativeDriver: resolved.useNativeDriver,
    });
  }

  return Animated.timing(value, {
    toValue,
    duration: resolved.resolvedDuration,
    delay: resolved.delay,
    easing: resolved.resolvedEasing,
    useNativeDriver: resolved.useNativeDriver,
  });
}

/**
 * Slide direction options
 */
export type SlideDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Gets the initial offset for a slide direction
 */
function getSlideOffset(direction: SlideDirection, distance: number): number {
  switch (direction) {
    case 'up':
      return distance; // Start below, slide up
    case 'down':
      return -distance; // Start above, slide down
    case 'left':
      return distance; // Start right, slide left
    case 'right':
      return -distance; // Start left, slide right
    default:
      return distance;
  }
}

/**
 * Creates a slide in animation from specified direction
 */
export function slideIn(
  value: Animated.Value,
  direction: SlideDirection = 'up',
  config?: AnimationConfig & { distance?: number }
): Animated.CompositeAnimation {
  const distance = config?.distance ?? 30;
  const offset = getSlideOffset(direction, distance);
  value.setValue(offset);
  return slide(value, 0, config);
}

/**
 * Creates a slide out animation to specified direction
 */
export function slideOut(
  value: Animated.Value,
  direction: SlideDirection = 'up',
  config?: AnimationConfig & { distance?: number }
): Animated.CompositeAnimation {
  const distance = config?.distance ?? 30;
  const offset = getSlideOffset(direction, distance);
  value.setValue(0);
  return slide(value, -offset, config);
}

/**
 * Creates a pulse animation (looping scale)
 *
 * @param value - Animated.Value to animate
 * @param config - Pulse configuration
 * @returns Animated.CompositeAnimation (looping)
 */
export function pulse(
  value: Animated.Value,
  config?: AnimationConfig & {
    minScale?: number;
    maxScale?: number;
    iterations?: number;
  }
): Animated.CompositeAnimation {
  const resolved = resolveConfig(config);
  const minScale = config?.minScale ?? 1;
  const maxScale = config?.maxScale ?? 1.05;
  const iterations = config?.iterations ?? -1; // -1 = infinite

  // If reduced motion, just set to the middle value and return no-op
  if (resolved.resolvedDuration === 0) {
    value.setValue((minScale + maxScale) / 2);
    return Animated.timing(value, {
      toValue: minScale,
      duration: 0,
      useNativeDriver: resolved.useNativeDriver,
    });
  }

  const pulseUp = Animated.timing(value, {
    toValue: maxScale,
    duration: resolved.resolvedDuration / 2,
    easing: resolved.resolvedEasing,
    useNativeDriver: resolved.useNativeDriver,
  });

  const pulseDown = Animated.timing(value, {
    toValue: minScale,
    duration: resolved.resolvedDuration / 2,
    easing: resolved.resolvedEasing,
    useNativeDriver: resolved.useNativeDriver,
  });

  const sequence = Animated.sequence([pulseUp, pulseDown]);

  if (iterations === -1) {
    return Animated.loop(sequence);
  }

  return Animated.loop(sequence, { iterations });
}

/**
 * Creates a spring animation
 *
 * @param value - Animated.Value to animate
 * @param toValue - Target value
 * @param config - Spring configuration
 * @returns Animated.CompositeAnimation
 */
export function spring(
  value: Animated.Value,
  toValue: number,
  config?: {
    friction?: number;
    tension?: number;
    useNativeDriver?: boolean;
    respectReducedMotion?: boolean;
  }
): Animated.CompositeAnimation {
  const useNativeDriver = config?.useNativeDriver ?? true;
  const respectReducedMotion = config?.respectReducedMotion ?? true;
  const shouldReduceMotion = respectReducedMotion && getReducedMotionPreference();

  if (shouldReduceMotion) {
    return Animated.timing(value, {
      toValue,
      duration: 0,
      useNativeDriver,
    });
  }

  return Animated.spring(value, {
    toValue,
    friction: config?.friction ?? 7,
    tension: config?.tension ?? 40,
    useNativeDriver,
  });
}

/**
 * Creates a shake animation (horizontal oscillation)
 *
 * @param value - Animated.Value to animate
 * @param config - Shake configuration
 * @returns Animated.CompositeAnimation
 */
export function shake(
  value: Animated.Value,
  config?: AnimationConfig & {
    intensity?: number;
    shakes?: number;
  }
): Animated.CompositeAnimation {
  const resolved = resolveConfig(config);
  const intensity = config?.intensity ?? 10;
  const shakes = config?.shakes ?? 3;

  if (resolved.resolvedDuration === 0) {
    value.setValue(0);
    return Animated.timing(value, {
      toValue: 0,
      duration: 0,
      useNativeDriver: resolved.useNativeDriver,
    });
  }

  const shakeDuration = resolved.resolvedDuration / (shakes * 2);
  const animations: Animated.CompositeAnimation[] = [];

  for (let i = 0; i < shakes; i++) {
    animations.push(
      Animated.timing(value, {
        toValue: intensity * (i % 2 === 0 ? 1 : -1),
        duration: shakeDuration,
        easing: Easing.linear,
        useNativeDriver: resolved.useNativeDriver,
      })
    );
    animations.push(
      Animated.timing(value, {
        toValue: intensity * (i % 2 === 0 ? -1 : 1),
        duration: shakeDuration,
        easing: Easing.linear,
        useNativeDriver: resolved.useNativeDriver,
      })
    );
  }

  // Return to center
  animations.push(
    Animated.timing(value, {
      toValue: 0,
      duration: shakeDuration,
      easing: Easing.linear,
      useNativeDriver: resolved.useNativeDriver,
    })
  );

  return Animated.sequence(animations);
}

/**
 * Combines multiple animations to run in parallel
 */
export function parallel(animations: Animated.CompositeAnimation[]): Animated.CompositeAnimation {
  return Animated.parallel(animations);
}

/**
 * Combines multiple animations to run in sequence
 */
export function sequence(animations: Animated.CompositeAnimation[]): Animated.CompositeAnimation {
  return Animated.sequence(animations);
}

/**
 * Staggers multiple animations
 */
export function stagger(
  delayMs: number,
  animations: Animated.CompositeAnimation[]
): Animated.CompositeAnimation {
  return Animated.stagger(delayMs, animations);
}

/**
 * Creates an interpolated value for color transitions
 *
 * @param value - Animated.Value (0 to 1)
 * @param fromColor - Starting color
 * @param toColor - Ending color
 * @returns Animated.AnimatedInterpolation
 */
export function interpolateColor(
  value: Animated.Value,
  fromColor: string,
  toColor: string
): Animated.AnimatedInterpolation<string> {
  return value.interpolate({
    inputRange: [0, 1],
    outputRange: [fromColor, toColor],
  });
}

/**
 * Preset animation configurations for common use cases
 */
export const ANIMATION_PRESETS = {
  /** Quick feedback for button presses */
  buttonPress: {
    duration: 'fast' as AnimationDuration,
    easing: 'easeOut' as AnimationEasingName,
  },
  /** Smooth modal/card entrance */
  modalEnter: {
    duration: 'normal' as AnimationDuration,
    easing: 'easeOut' as AnimationEasingName,
  },
  /** Modal/card exit */
  modalExit: {
    duration: 'fast' as AnimationDuration,
    easing: 'easeIn' as AnimationEasingName,
  },
  /** List item stagger */
  listItem: {
    duration: 'normal' as AnimationDuration,
    easing: 'easeOut' as AnimationEasingName,
  },
  /** Success celebration */
  celebration: {
    duration: 'normal' as AnimationDuration,
    easing: 'spring' as AnimationEasingName,
  },
  /** Error shake */
  error: {
    duration: 'normal' as AnimationDuration,
    shakes: 3,
    intensity: 10,
  },
} as const;
