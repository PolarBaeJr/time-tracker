/**
 * OnboardingScreen
 *
 * Multi-step onboarding wizard for new users.
 * Steps:
 * 1. Welcome with app logo
 * 2. Quick overview of features
 * 3. Theme selection
 * 4. Optional: Create first category
 * 5. Done - start tracking
 *
 * Uses slide animations between steps and integrates with the onboarding store.
 */

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, Icon, Card } from '@/components/ui';
import { AnimatedView } from '@/components/ui/AnimatedView';
import {
  OnboardingStep,
  OnboardingProgress,
  type OnboardingStepData,
} from '@/components/onboarding';
import { ThemeSelector } from '@/components/settings';
import { useTheme, spacing, fontWeights, borderRadius } from '@/theme';
import {
  useOnboarding,
  completeStep,
  skipOnboarding,
  setOnboardingComplete,
  startOnboarding,
} from '@/stores/onboardingStore';
import { ALL_ONBOARDING_STEPS } from '@/schemas/onboarding';

/**
 * Step configuration for the onboarding flow
 * Maps schema steps to UI steps
 */
const ONBOARDING_STEPS: OnboardingStepData[] = [
  {
    id: 'welcome',
    title: 'Welcome to WorkTracker',
    description:
      "Track your time, achieve your goals, and build better habits. Let's get you set up in just a few steps.",
    icon: 'waving-hand',
    skippable: false,
  },
  {
    id: 'features',
    title: 'Powerful Features',
    description:
      'Timer tracking, analytics, categories, goals, notes, and more. Everything you need to master your time.',
    icon: 'timer',
    skippable: true,
  },
  {
    id: 'theme',
    title: 'Choose Your Theme',
    description: 'Select your preferred appearance. You can always change this later in Settings.',
    icon: 'settings',
    skippable: true,
  },
  {
    id: 'category_prompt',
    title: 'Organize with Categories',
    description:
      'Categories help you organize your time by project or activity. You can create your first one now or skip this step.',
    icon: 'category',
    skippable: true,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description:
      'Start tracking your time and achieving your goals. You can access all features from the main menu.',
    icon: 'celebration',
    skippable: false,
  },
];

/**
 * Feature item for the features overview step
 */
interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps): React.ReactElement {
  const { colors } = useTheme();

  const getFeatureIcon = (
    iconName: string
  ): 'time' | 'bar-chart' | 'folder' | 'flag' | 'file-text' => {
    const mapping: Record<string, 'time' | 'bar-chart' | 'folder' | 'flag' | 'file-text'> = {
      timer: 'time',
      analytics: 'bar-chart',
      categories: 'folder',
      goals: 'flag',
      notes: 'file-text',
    };
    return mapping[iconName] ?? 'time';
  };

  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIconContainer, { backgroundColor: colors.surfaceVariant }]}>
        <Icon name={getFeatureIcon(icon)} size={24} color={colors.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text variant="label" style={styles.featureTitle}>
          {title}
        </Text>
        <Text variant="caption" color="secondary">
          {description}
        </Text>
      </View>
    </View>
  );
}

/**
 * OnboardingScreen Component
 */
export function OnboardingScreen(): React.ReactElement {
  const { colors } = useTheme();
  const { hasCompleted, isHydrated } = useOnboarding();

  // Local step index for UI (0-based)
  const [stepIndex, setStepIndex] = useState(0);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');

  // Start onboarding when screen loads
  useEffect(() => {
    if (isHydrated && !hasCompleted) {
      startOnboarding();
    }
  }, [isHydrated, hasCompleted]);

  // Total steps
  const totalSteps = ONBOARDING_STEPS.length;
  const currentStepData = ONBOARDING_STEPS[stepIndex];
  const isLastStep = stepIndex === totalSteps - 1;
  const isFirstStep = stepIndex === 0;

  // Go to next step
  const handleNext = useCallback(() => {
    if (isLastStep) {
      // Complete onboarding
      setOnboardingComplete();
      return;
    }

    setAnimationDirection('right');
    setStepIndex(prev => Math.min(prev + 1, totalSteps - 1));

    // Mark step as complete in store
    const schemaStep = ALL_ONBOARDING_STEPS[Math.min(stepIndex, ALL_ONBOARDING_STEPS.length - 1)];
    if (schemaStep) {
      completeStep(schemaStep);
    }
  }, [isLastStep, stepIndex, totalSteps]);

  // Go to previous step
  const handleBack = useCallback(() => {
    if (isFirstStep) return;

    setAnimationDirection('left');
    setStepIndex(prev => Math.max(prev - 1, 0));
  }, [isFirstStep]);

  // Skip onboarding
  const handleSkip = useCallback(() => {
    skipOnboarding();
  }, []);

  // Render step content based on current step
  const renderStepContent = useCallback(() => {
    switch (currentStepData.id) {
      case 'features':
        return (
          <ScrollView
            style={styles.featuresScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.featuresContent}
          >
            <FeatureItem
              icon="timer"
              title="Time Tracking"
              description="Track your work with a simple timer or manual entries"
            />
            <FeatureItem
              icon="analytics"
              title="Analytics"
              description="Visualize your time with charts and statistics"
            />
            <FeatureItem
              icon="categories"
              title="Categories"
              description="Organize entries by project or activity type"
            />
            <FeatureItem
              icon="goals"
              title="Goals"
              description="Set and track monthly time goals"
            />
            <FeatureItem
              icon="notes"
              title="Notes & Todos"
              description="Keep notes and manage tasks alongside your time"
            />
          </ScrollView>
        );

      case 'theme':
        return (
          <Card padding="lg" elevation="sm" style={styles.themeCard}>
            <ThemeSelector />
          </Card>
        );

      case 'category_prompt':
        return (
          <View style={styles.categoryPrompt}>
            <Card padding="lg" elevation="sm" style={styles.categoryCard}>
              <View style={styles.categoryInfo}>
                <View style={[styles.categoryIconBg, { backgroundColor: colors.surfaceVariant }]}>
                  <Icon name="folder" size={32} color={colors.primary} />
                </View>
                <Text variant="body" color="secondary" style={styles.categoryText}>
                  Categories help you organize time entries by project (e.g., Work, Personal,
                  Learning).
                </Text>
              </View>
              <Text variant="caption" color="muted" style={styles.categoryHint}>
                You can create categories anytime from Settings.
              </Text>
            </Card>
          </View>
        );

      case 'complete':
        return (
          <AnimatedView preset="scaleIn" delay={200}>
            <View style={styles.completeContainer}>
              <View style={[styles.completeCheckCircle, { backgroundColor: colors.success }]}>
                <Icon name="check" size={48} color="#FFFFFF" />
              </View>
              <Text variant="body" color="secondary" style={styles.completeText}>
                Everything is ready. Tap below to start tracking your time!
              </Text>
            </View>
          </AnimatedView>
        );

      default:
        return null;
    }
  }, [currentStepData.id, colors]);

  // Loading state while hydrating
  if (!isHydrated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="muted">
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Header with Skip button */}
      <View style={styles.header}>
        {!isFirstStep && (
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        )}
        <View style={styles.headerSpacer} />
        {currentStepData.skippable && !isLastStep && (
          <Pressable
            onPress={handleSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text variant="label" color="primary">
              Skip
            </Text>
          </Pressable>
        )}
      </View>

      {/* Progress Indicator */}
      <OnboardingProgress totalSteps={totalSteps} currentStep={stepIndex} style={styles.progress} />

      {/* Step Content */}
      <View style={styles.stepContainer}>
        <OnboardingStep
          step={currentStepData}
          isActive={true}
          animationDirection={animationDirection}
        >
          {renderStepContent()}
        </OnboardingStep>
      </View>

      {/* Footer with Navigation Buttons */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          size="lg"
          onPress={handleNext}
          style={styles.nextButton}
          accessibilityLabel={isLastStep ? 'Get Started' : 'Continue'}
        >
          {isLastStep ? 'Get Started' : 'Continue'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  skipButton: {
    padding: spacing.xs,
  },
  progress: {
    marginBottom: spacing.sm,
  },
  stepContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.lg,
  },
  nextButton: {
    width: '100%',
  },

  // Features step
  featuresScroll: {
    flex: 1,
  },
  featuresContent: {
    paddingBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
  },

  // Theme step
  themeCard: {
    marginBottom: spacing.md,
  },

  // Category prompt step
  categoryPrompt: {
    flex: 1,
  },
  categoryCard: {
    marginBottom: spacing.md,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  categoryIconBg: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryText: {
    flex: 1,
    lineHeight: 22,
  },
  categoryHint: {
    fontStyle: 'italic',
  },

  // Complete step
  completeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  completeCheckCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  completeText: {
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
});

export type OnboardingScreenProps = Record<string, never>;

export default OnboardingScreen;
