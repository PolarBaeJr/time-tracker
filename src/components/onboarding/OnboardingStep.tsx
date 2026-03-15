/**
 * OnboardingStep Component
 *
 * Individual step component for the onboarding wizard.
 * Displays an illustration (icon), title, description, and action area.
 * Uses slide animations for smooth transitions between steps.
 */

import * as React from 'react';
import { View, StyleSheet, type ViewStyle, Dimensions } from 'react-native';
import { Text, Icon, type IconName } from '@/components/ui';
import { useTheme, spacing, fontSizes, fontWeights, borderRadius } from '@/theme';
import { AnimatedView } from '@/components/ui/AnimatedView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * OnboardingStep step data
 */
export interface OnboardingStepData {
  /** Unique step identifier */
  id: string;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Icon name for the illustration */
  icon: string;
  /** Whether the step can be skipped */
  skippable?: boolean;
}

/**
 * OnboardingStep component props
 */
export interface OnboardingStepProps {
  /** Step data to display */
  step: OnboardingStepData;
  /** Whether this step is currently active (visible) */
  isActive: boolean;
  /** Direction of the slide animation */
  animationDirection?: 'left' | 'right';
  /** Children to render in the action area (buttons, forms, etc.) */
  children?: React.ReactNode;
  /** Additional styles for the container */
  style?: ViewStyle;
}

/**
 * Maps onboarding step icons to IconName
 */
function getIconName(icon: string): IconName {
  const iconMapping: Record<string, IconName> = {
    'waving-hand': 'home', // Welcome
    category: 'folder', // Categories
    'add-circle': 'add', // Create entry
    'track-changes': 'flag', // Goals
    celebration: 'check', // Complete
    // Feature overview icons
    timer: 'time',
    analytics: 'bar-chart',
    notes: 'file-text',
  };
  return iconMapping[icon] ?? 'check';
}

/**
 * OnboardingStep Component
 *
 * Renders a single onboarding step with illustration, title, description,
 * and optional action area for interactive elements.
 */
export function OnboardingStep({
  step,
  isActive,
  animationDirection = 'right',
  children,
  style,
}: OnboardingStepProps): React.ReactElement | null {
  const { colors } = useTheme();

  if (!isActive) {
    return null;
  }

  const preset = animationDirection === 'right' ? 'slideLeft' : 'slideRight';

  return (
    <AnimatedView preset={preset} duration={300} style={[styles.container, style]}>
      {/* Illustration Area */}
      <View style={[styles.illustrationContainer, { backgroundColor: colors.surfaceVariant }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
          <Icon name={getIconName(step.icon)} size={64} color="#FFFFFF" />
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        <Text variant="display" style={styles.title}>
          {step.title}
        </Text>
        <Text variant="body" color="secondary" style={styles.description}>
          {step.description}
        </Text>
      </View>

      {/* Action Area (buttons, forms, etc.) */}
      {children && <View style={styles.actionContainer}>{children}</View>}
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    paddingHorizontal: spacing.lg,
  },
  illustrationContainer: {
    flex: 1,
    minHeight: 200,
    maxHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  actionContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.lg,
  },
});

export default OnboardingStep;
