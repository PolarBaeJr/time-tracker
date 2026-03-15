/**
 * Hook for animating a number value counting up from a start to an end value.
 * Commonly used for totals and statistics that should animate on mount.
 *
 * Features:
 * - Smooth eased animation from startValue to endValue
 * - Respects reduced motion preferences
 * - Formatted output for display
 * - Configurable duration and decimal places
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';

export interface UseCountUpAnimationOptions {
  /** Starting value for the animation (default: 0) */
  startValue?: number;
  /** End/target value to count up to */
  endValue: number;
  /** Duration of the animation in ms (default: 600) */
  duration?: number;
  /** Number of decimal places to show (default: 1) */
  decimals?: number;
  /** Format function for the display value */
  formatter?: (value: number) => string;
  /** Delay before starting animation in ms (default: 0) */
  delay?: number;
  /** Whether to animate (default: true) */
  animate?: boolean;
}

export interface UseCountUpAnimationResult {
  /** Current animated value (number) */
  value: number;
  /** Formatted display string */
  displayValue: string;
  /** Whether the animation is complete */
  isComplete: boolean;
}

/**
 * Default formatter that shows value with specified decimals
 */
function defaultFormatter(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Hook that animates a number counting up from start to end value
 */
export function useCountUpAnimation({
  startValue = 0,
  endValue,
  duration = 600,
  decimals = 1,
  formatter,
  delay = 0,
  animate = true,
}: UseCountUpAnimationOptions): UseCountUpAnimationResult {
  // Get animation preferences from UX settings
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animate && animationsEnabled && !reducedMotion;

  // Compute initial value based on animation settings
  const initialValue = useMemo(
    () => (shouldAnimate ? startValue : endValue),
    // Only compute on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // State for the current animated value
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [isComplete, setIsComplete] = useState(!shouldAnimate);

  // Animated value ref - use useState with lazy initializer for React Compiler compatibility
  const [animatedValue] = useState(() => new Animated.Value(shouldAnimate ? 0 : 1));

  // Track if animation has run
  const hasAnimatedRef = useRef(false);

  // Track the previous end value to detect changes
  const prevEndValueRef = useRef(endValue);

  // Store callback refs for animation listeners
  const animationCallbackRef = useRef<{
    listenerId?: string;
    startVal: number;
    endVal: number;
  }>({ startVal: startValue, endVal: endValue });

  useEffect(() => {
    if (shouldAnimate && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      animationCallbackRef.current = { startVal: startValue, endVal: endValue };

      // Set up listener to update the current value
      const listenerId = animatedValue.addListener(({ value }) => {
        // Interpolate between start and end values using refs
        const { startVal, endVal } = animationCallbackRef.current;
        const interpolatedValue = startVal + (endVal - startVal) * value;
        setCurrentValue(interpolatedValue);
      });

      animationCallbackRef.current.listenerId = listenerId;

      // Run the animation
      const timeoutId = setTimeout(() => {
        Animated.timing(animatedValue, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // Number updates require JS driver
        }).start(({ finished }) => {
          if (finished) {
            const { endVal } = animationCallbackRef.current;
            setCurrentValue(endVal);
            setIsComplete(true);
          }
        });
      }, delay);

      return () => {
        clearTimeout(timeoutId);
        if (animationCallbackRef.current.listenerId) {
          animatedValue.removeListener(animationCallbackRef.current.listenerId);
        }
      };
    }
    // Note: For non-animated case, we rely on initial state value
  }, [shouldAnimate, startValue, endValue, duration, delay, animatedValue]);

  // Handle end value changes after initial animation
  useEffect(() => {
    if (hasAnimatedRef.current && prevEndValueRef.current !== endValue) {
      const oldValue = currentValue;
      prevEndValueRef.current = endValue;

      if (shouldAnimate) {
        // Update the callback ref for the new animation
        animationCallbackRef.current = {
          ...animationCallbackRef.current,
          startVal: oldValue,
          endVal: endValue,
        };
        animatedValue.setValue(0);

        const listenerId = animatedValue.addListener(({ value }) => {
          const { startVal, endVal } = animationCallbackRef.current;
          const interpolatedValue = startVal + (endVal - startVal) * value;
          setCurrentValue(interpolatedValue);
        });

        animationCallbackRef.current.listenerId = listenerId;

        Animated.timing(animatedValue, {
          toValue: 1,
          duration: duration / 2, // Faster for updates
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            const { endVal } = animationCallbackRef.current;
            setCurrentValue(endVal);
          }
          if (animationCallbackRef.current.listenerId) {
            animatedValue.removeListener(animationCallbackRef.current.listenerId);
          }
        });
      }
    }
  }, [endValue, shouldAnimate, currentValue, duration, animatedValue]);

  // Format the display value
  const displayValue = formatter
    ? formatter(currentValue)
    : defaultFormatter(currentValue, decimals);

  return {
    value: currentValue,
    displayValue,
    isComplete,
  };
}

/**
 * Formatter for hours (e.g., "12.5h" or "45m")
 */
export function formatHoursCountUp(hours: number): string {
  if (hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export default useCountUpAnimation;
