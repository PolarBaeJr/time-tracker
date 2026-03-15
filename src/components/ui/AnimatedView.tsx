/**
 * AnimatedView component with animation presets
 *
 * A wrapper component that provides easy-to-use animation presets for
 * fadeIn, slideUp, scaleIn animations with configurable duration and delay.
 * Respects prefers-reduced-motion setting.
 */

import * as React from 'react';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, StyleSheet, type ViewStyle, type ViewProps, type StyleProp } from 'react-native';
import {
  ANIMATION_DURATION,
  getReducedMotionPreference,
  type AnimationConfig,
  type AnimationDuration,
} from '@/lib/animations';

/**
 * Animation preset types
 */
export type AnimationPreset =
  | 'fadeIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'scaleIn'
  | 'none';

/**
 * AnimatedView component props
 */
export interface AnimatedViewProps extends Omit<ViewProps, 'style'> {
  /** Animation preset to use on mount */
  preset?: AnimationPreset;
  /** Animation duration in ms or preset name */
  duration?: number | AnimationDuration;
  /** Delay before animation starts in ms */
  delay?: number;
  /** Whether to animate on mount (default: true) */
  animateOnMount?: boolean;
  /** Whether to respect reduced motion preference (default: true) */
  respectReducedMotion?: boolean;
  /** Custom style for the view */
  style?: StyleProp<ViewStyle>;
  /** Children to render */
  children?: React.ReactNode;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** Distance for slide animations (default: 20) */
  slideDistance?: number;
  /** Initial scale for scaleIn animation (default: 0.9) */
  initialScale?: number;
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
 * AnimatedView component
 *
 * Provides easy animation presets for common view animations.
 *
 * @example
 * ```tsx
 * // Fade in on mount
 * <AnimatedView preset="fadeIn">
 *   <Text>Hello World</Text>
 * </AnimatedView>
 *
 * // Slide up with custom duration
 * <AnimatedView preset="slideUp" duration={400} delay={200}>
 *   <Card>Content</Card>
 * </AnimatedView>
 *
 * // Scale in with callback
 * <AnimatedView
 *   preset="scaleIn"
 *   onAnimationComplete={() => console.log('Done!')}
 * >
 *   <Button>Click Me</Button>
 * </AnimatedView>
 * ```
 */
export function AnimatedView({
  preset = 'fadeIn',
  duration = 'normal',
  delay = 0,
  animateOnMount = true,
  respectReducedMotion = true,
  style,
  children,
  onAnimationComplete,
  slideDistance = 20,
  initialScale = 0.9,
  ...viewProps
}: AnimatedViewProps): React.ReactElement {
  // Create animated values using useMemo to avoid recreating on every render
  // These are stable references that persist across renders
  const animatedValues = useMemo(
    () => ({
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      scale: new Animated.Value(1),
    }),
    []
  );

  // Track animation state
  const hasAnimatedRef = useRef(false);
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Check reduced motion
  const shouldReduceMotion = respectReducedMotion && getReducedMotionPreference();

  // Resolve duration
  const durationMs = resolveDuration(duration);
  const effectiveDuration = shouldReduceMotion ? 0 : durationMs;

  /**
   * Set initial values based on preset
   */
  const setInitialValues = useCallback(() => {
    const { opacity, translateY, translateX, scale } = animatedValues;

    if (preset === 'none' || !animateOnMount) {
      opacity.setValue(1);
      return;
    }

    if (shouldReduceMotion) {
      // Set final values immediately for reduced motion
      opacity.setValue(1);
      translateY.setValue(0);
      translateX.setValue(0);
      scale.setValue(1);
      return;
    }

    switch (preset) {
      case 'fadeIn':
        opacity.setValue(0);
        break;
      case 'slideUp':
        opacity.setValue(0);
        translateY.setValue(slideDistance);
        break;
      case 'slideDown':
        opacity.setValue(0);
        translateY.setValue(-slideDistance);
        break;
      case 'slideLeft':
        opacity.setValue(0);
        translateX.setValue(slideDistance);
        break;
      case 'slideRight':
        opacity.setValue(0);
        translateX.setValue(-slideDistance);
        break;
      case 'scaleIn':
        opacity.setValue(0);
        scale.setValue(initialScale);
        break;
    }
  }, [preset, animateOnMount, shouldReduceMotion, animatedValues, slideDistance, initialScale]);

  /**
   * Run the entrance animation
   */
  const animate = useCallback(() => {
    const { opacity, translateY, translateX, scale } = animatedValues;
    const hasAnimated = hasAnimatedRef.current;
    const activeAnimation = activeAnimationRef.current;

    if (preset === 'none' || !animateOnMount || hasAnimated) {
      return;
    }

    hasAnimatedRef.current = true;

    // Stop any existing animation
    if (activeAnimation) {
      activeAnimation.stop();
    }

    // Build animations based on preset
    const animations: Animated.CompositeAnimation[] = [];

    // All presets include fade
    animations.push(
      Animated.timing(opacity, {
        toValue: 1,
        duration: effectiveDuration,
        delay,
        useNativeDriver: true,
      })
    );

    switch (preset) {
      case 'slideUp':
      case 'slideDown':
        animations.push(
          Animated.timing(translateY, {
            toValue: 0,
            duration: effectiveDuration,
            delay,
            useNativeDriver: true,
          })
        );
        break;
      case 'slideLeft':
      case 'slideRight':
        animations.push(
          Animated.timing(translateX, {
            toValue: 0,
            duration: effectiveDuration,
            delay,
            useNativeDriver: true,
          })
        );
        break;
      case 'scaleIn':
        animations.push(
          Animated.timing(scale, {
            toValue: 1,
            duration: effectiveDuration,
            delay,
            useNativeDriver: true,
          })
        );
        break;
    }

    const animation = Animated.parallel(animations);
    activeAnimationRef.current = animation;

    animation.start(({ finished }) => {
      activeAnimationRef.current = null;
      if (finished) {
        onAnimationComplete?.();
      }
    });
  }, [preset, animateOnMount, effectiveDuration, delay, animatedValues, onAnimationComplete]);

  // Set initial values and animate on mount
  useEffect(() => {
    setInitialValues();
    animate();

    // Cleanup on unmount - capture the ref value before cleanup
    const activeAnimation = activeAnimationRef.current;

    return () => {
      if (activeAnimation) {
        activeAnimation.stop();
      }
    };
  }, [setInitialValues, animate]);

  // Build animated style using useMemo
  const animatedStyle = useMemo(
    (): Animated.WithAnimatedObject<ViewStyle> => ({
      opacity: animatedValues.opacity,
      transform: [
        { translateY: animatedValues.translateY },
        { translateX: animatedValues.translateX },
        { scale: animatedValues.scale },
      ],
    }),
    [animatedValues]
  );

  return (
    <Animated.View {...viewProps} style={[styles.container, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * AnimatedView with imperative control
 *
 * Provides methods to trigger animations programmatically.
 */
export interface AnimatedViewImperativeHandle {
  /** Trigger fade in animation */
  fadeIn: (config?: Partial<AnimationConfig>) => void;
  /** Trigger fade out animation */
  fadeOut: (config?: Partial<AnimationConfig>) => void;
  /** Trigger slide animation */
  slide: (direction: 'up' | 'down' | 'left' | 'right', config?: Partial<AnimationConfig>) => void;
  /** Trigger scale animation */
  scaleTo: (toValue: number, config?: Partial<AnimationConfig>) => void;
  /** Reset to initial state */
  reset: () => void;
}

const styles = StyleSheet.create({
  container: {
    // Empty base style - component inherits flex behavior from parent
  },
});

export default AnimatedView;
