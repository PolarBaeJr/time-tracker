/**
 * OnboardingProgress Component
 *
 * Dot indicators showing progress through the onboarding flow.
 * Animated transitions between active states.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, StyleSheet, Animated, type ViewStyle } from 'react-native';
import { useTheme, spacing, borderRadius } from '@/theme';
import { ANIMATION_DURATION, ANIMATION_EASING, getReducedMotionPreference } from '@/lib/animations';

/**
 * OnboardingProgress component props
 */
export interface OnboardingProgressProps {
  /** Total number of steps */
  totalSteps: number;
  /** Current step index (0-based) */
  currentStep: number;
  /** Additional styles for the container */
  style?: ViewStyle;
}

/**
 * Single progress dot component with animation
 */
interface ProgressDotProps {
  isActive: boolean;
  isCompleted: boolean;
}

function ProgressDot({ isActive, isCompleted }: ProgressDotProps): React.ReactElement {
  const { colors } = useTheme();
  const shouldAnimate = !getReducedMotionPreference();

  // Use useState with lazy initializer for React Compiler compatibility
  const [scaleValue] = useState(() => new Animated.Value(isActive ? 1.2 : 1));
  const [opacityValue] = useState(() => new Animated.Value(isActive || isCompleted ? 1 : 0.4));

  useEffect(() => {
    if (!shouldAnimate) {
      scaleValue.setValue(isActive ? 1.2 : 1);
      opacityValue.setValue(isActive || isCompleted ? 1 : 0.4);
      return;
    }

    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: isActive ? 1.2 : 1,
        duration: ANIMATION_DURATION.fast,
        easing: ANIMATION_EASING.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: isActive || isCompleted ? 1 : 0.4,
        duration: ANIMATION_DURATION.fast,
        easing: ANIMATION_EASING.easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, isCompleted, scaleValue, opacityValue, shouldAnimate]);

  const backgroundColor = isActive || isCompleted ? colors.primary : colors.surfaceVariant;

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor,
          transform: [{ scale: scaleValue }],
          opacity: opacityValue,
        },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${isActive ? 'current' : isCompleted ? 'completed' : 'upcoming'}`}
    />
  );
}

/**
 * OnboardingProgress Component
 *
 * Displays progress dots for the onboarding flow.
 * Active dot is larger and highlighted.
 * Completed dots are also highlighted.
 */
export function OnboardingProgress({
  totalSteps,
  currentStep,
  style,
}: OnboardingProgressProps): React.ReactElement {
  const dots = Array.from({ length: totalSteps }, (_, index) => ({
    isActive: index === currentStep,
    isCompleted: index < currentStep,
  }));

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}`}
      accessibilityValue={{
        min: 0,
        max: totalSteps - 1,
        now: currentStep,
        text: `Step ${currentStep + 1} of ${totalSteps}`,
      }}
    >
      {dots.map((dot, index) => (
        <ProgressDot key={index} isActive={dot.isActive} isCompleted={dot.isCompleted} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
});

export default OnboardingProgress;
