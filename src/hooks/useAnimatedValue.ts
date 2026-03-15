/**
 * useAnimatedValue hook for managing Animated.Value instances with proper cleanup
 *
 * This hook provides a clean interface for creating and managing Animated.Value
 * instances, handling cleanup on unmount, and providing utility methods for
 * common animation patterns.
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Animated } from 'react-native';
import type { AnimationConfig } from '@/lib/animations';
import {
  fade,
  fadeIn,
  fadeOut,
  scale,
  scaleIn,
  scaleOut,
  slide,
  slideIn,
  slideOut,
  pulse,
  spring,
  shake,
  type SlideDirection,
} from '@/lib/animations';

/**
 * Options for useAnimatedValue hook
 */
export interface UseAnimatedValueOptions {
  /** Initial value for the Animated.Value */
  initialValue?: number;
}

/**
 * Return type for useAnimatedValue hook
 */
export interface UseAnimatedValueResult {
  /** The Animated.Value instance */
  value: Animated.Value;

  /** Set the value immediately without animation */
  setValue: (toValue: number) => void;

  /** Reset to initial value without animation */
  reset: () => void;

  /** Stop all running animations on this value */
  stop: () => void;

  /** Animation methods */
  animations: {
    /** Fade to a specific opacity */
    fade: (toValue: number, config?: AnimationConfig) => Animated.CompositeAnimation;
    /** Fade in (0 -> 1) */
    fadeIn: (config?: AnimationConfig) => Animated.CompositeAnimation;
    /** Fade out (1 -> 0) */
    fadeOut: (config?: AnimationConfig) => Animated.CompositeAnimation;
    /** Scale to a specific value */
    scale: (toValue: number, config?: AnimationConfig) => Animated.CompositeAnimation;
    /** Scale in with optional overshoot */
    scaleIn: (config?: AnimationConfig & { overshoot?: boolean }) => Animated.CompositeAnimation;
    /** Scale out */
    scaleOut: (config?: AnimationConfig) => Animated.CompositeAnimation;
    /** Slide to a specific translation */
    slide: (toValue: number, config?: AnimationConfig) => Animated.CompositeAnimation;
    /** Slide in from direction */
    slideIn: (
      direction?: SlideDirection,
      config?: AnimationConfig & { distance?: number }
    ) => Animated.CompositeAnimation;
    /** Slide out to direction */
    slideOut: (
      direction?: SlideDirection,
      config?: AnimationConfig & { distance?: number }
    ) => Animated.CompositeAnimation;
    /** Pulsing animation */
    pulse: (
      config?: AnimationConfig & { minScale?: number; maxScale?: number; iterations?: number }
    ) => Animated.CompositeAnimation;
    /** Spring animation */
    spring: (
      toValue: number,
      config?: { friction?: number; tension?: number; useNativeDriver?: boolean }
    ) => Animated.CompositeAnimation;
    /** Shake animation */
    shake: (
      config?: AnimationConfig & { intensity?: number; shakes?: number }
    ) => Animated.CompositeAnimation;
  };
}

/**
 * Hook for managing an Animated.Value instance with cleanup
 *
 * @param options - Configuration options
 * @returns UseAnimatedValueResult with the value and animation utilities
 *
 * @example
 * ```tsx
 * const { value, animations, setValue, stop } = useAnimatedValue({ initialValue: 0 });
 *
 * // Start a fade in animation
 * useEffect(() => {
 *   animations.fadeIn({ duration: 300 }).start();
 * }, []);
 *
 * // Use the value in your component
 * <Animated.View style={{ opacity: value }}>
 *   <Text>Hello</Text>
 * </Animated.View>
 * ```
 */
export function useAnimatedValue(options?: UseAnimatedValueOptions): UseAnimatedValueResult {
  const initialValue = options?.initialValue ?? 0;

  // Use useState with lazy initializer for a stable Animated.Value instance
  // This is the recommended pattern for React Compiler compatibility
  // because useState's lazy initializer only runs once on mount
  const [animatedValue] = useState(() => new Animated.Value(initialValue));

  // Store the initial value for reset
  const initialValueRef = useRef(initialValue);

  // Store all active animations for cleanup
  const activeAnimationsRef = useRef<Set<Animated.CompositeAnimation>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    // Capture current state for cleanup
    const currentAnimations = activeAnimationsRef.current;
    const currentValue = animatedValue;

    return () => {
      // Stop all active animations
      currentAnimations.forEach(anim => {
        anim.stop();
      });
      currentAnimations.clear();

      // Stop any running animation on the value
      currentValue.stopAnimation();
    };
  }, [animatedValue]);

  // Set value immediately
  const setValue = useCallback(
    (toValue: number) => {
      animatedValue.setValue(toValue);
    },
    [animatedValue]
  );

  // Reset to initial value
  const reset = useCallback(() => {
    animatedValue.setValue(initialValueRef.current);
  }, [animatedValue]);

  // Stop all animations
  const stop = useCallback(() => {
    animatedValue.stopAnimation();
    activeAnimationsRef.current.forEach(anim => {
      anim.stop();
    });
    activeAnimationsRef.current.clear();
  }, [animatedValue]);

  // Wrap animation to track for cleanup
  const trackAnimation = useCallback(
    (animation: Animated.CompositeAnimation): Animated.CompositeAnimation => {
      activeAnimationsRef.current.add(animation);

      // Wrap start to remove from tracking when complete
      const originalStart = animation.start.bind(animation);
      animation.start = (callback?: Animated.EndCallback) => {
        originalStart(result => {
          activeAnimationsRef.current.delete(animation);
          callback?.(result);
        });
      };

      return animation;
    },
    []
  );

  // Animation methods - use the stable animatedValue from useState
  const animations = useMemo(
    () => ({
      fade: (toValue: number, config?: AnimationConfig) =>
        trackAnimation(fade(animatedValue, toValue, config)),

      fadeIn: (config?: AnimationConfig) => trackAnimation(fadeIn(animatedValue, config)),

      fadeOut: (config?: AnimationConfig) => trackAnimation(fadeOut(animatedValue, config)),

      scale: (toValue: number, config?: AnimationConfig) =>
        trackAnimation(scale(animatedValue, toValue, config)),

      scaleIn: (config?: AnimationConfig & { overshoot?: boolean }) =>
        trackAnimation(scaleIn(animatedValue, config)),

      scaleOut: (config?: AnimationConfig) => trackAnimation(scaleOut(animatedValue, config)),

      slide: (toValue: number, config?: AnimationConfig) =>
        trackAnimation(slide(animatedValue, toValue, config)),

      slideIn: (direction?: SlideDirection, config?: AnimationConfig & { distance?: number }) =>
        trackAnimation(slideIn(animatedValue, direction, config)),

      slideOut: (direction?: SlideDirection, config?: AnimationConfig & { distance?: number }) =>
        trackAnimation(slideOut(animatedValue, direction, config)),

      pulse: (
        config?: AnimationConfig & { minScale?: number; maxScale?: number; iterations?: number }
      ) => trackAnimation(pulse(animatedValue, config)),

      spring: (
        toValue: number,
        config?: { friction?: number; tension?: number; useNativeDriver?: boolean }
      ) => trackAnimation(spring(animatedValue, toValue, config)),

      shake: (config?: AnimationConfig & { intensity?: number; shakes?: number }) =>
        trackAnimation(shake(animatedValue, config)),
    }),
    [animatedValue, trackAnimation]
  );

  // Return stable result object using useMemo
  return useMemo(
    () => ({
      value: animatedValue,
      setValue,
      reset,
      stop,
      animations,
    }),
    [animatedValue, setValue, reset, stop, animations]
  );
}

/**
 * Creates multiple Animated.Value instances for complex animations
 *
 * @param count - Number of Animated.Value instances to create
 * @param initialValue - Initial value for all instances
 * @returns Array of UseAnimatedValueResult
 *
 * @example
 * ```tsx
 * const [opacity, scale, translateY] = useAnimatedValues(3, 0);
 *
 * useEffect(() => {
 *   Animated.parallel([
 *     opacity.animations.fadeIn(),
 *     scale.animations.scaleIn(),
 *     translateY.animations.slideIn('up'),
 *   ]).start();
 * }, []);
 * ```
 */
export function useAnimatedValues(count: number, initialValue = 0): UseAnimatedValueResult[] {
  // Create stable array of hooks
  // Note: This approach is safe because count should be constant
  const results: UseAnimatedValueResult[] = [];

  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results.push(useAnimatedValue({ initialValue }));
  }

  return results;
}

export type { AnimationConfig, SlideDirection };
