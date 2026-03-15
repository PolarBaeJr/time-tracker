/**
 * AchievementUnlock Component
 *
 * A modal/overlay that appears when a new achievement is unlocked.
 *
 * Features:
 * - Confetti celebration effect
 * - Animated badge reveal
 * - Theme-aware styling
 * - Auto-dismiss option
 * - Respects reduced motion settings
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Animated, Modal, StyleSheet, View, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfettiSafe } from '@/components/ui/Confetti';
import { AchievementBadge } from './AchievementBadge';
import { useTheme, spacing, shadows } from '@/theme';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { getReducedMotionPreference, ANIMATION_DURATION, parallel, spring } from '@/lib/animations';
import type { Achievement } from '@/schemas/achievement';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the AchievementUnlock component
 */
export interface AchievementUnlockProps {
  /** Achievement to display (null to hide modal) */
  achievement: Achievement | null;
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when the modal is dismissed */
  onDismiss: () => void;
  /** Auto-dismiss delay in ms (0 = no auto-dismiss, default: 5000) */
  autoDismissDelay?: number;
  /** Whether to show confetti (default: true) */
  showConfetti?: boolean;
  /** Label for the dismiss button (default: "Awesome!") */
  dismissLabel?: string;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_AUTO_DISMISS = 5000;
const ANIMATION_DELAY = 200;
// CONFETTI_DELAY is planned for a staggered confetti effect in future enhancement
// const CONFETTI_DELAY = 400;

// ============================================================================
// ACHIEVEMENT UNLOCK COMPONENT
// ============================================================================

/**
 * AchievementUnlock Component
 *
 * Displays a celebratory modal when an achievement is unlocked.
 *
 * @example
 * ```tsx
 * const [achievement, setAchievement] = useState<Achievement | null>(null);
 *
 * <AchievementUnlock
 *   achievement={achievement}
 *   visible={!!achievement}
 *   onDismiss={() => setAchievement(null)}
 *   showConfetti
 * />
 * ```
 */
export function AchievementUnlock({
  achievement,
  visible,
  onDismiss,
  autoDismissDelay = DEFAULT_AUTO_DISMISS,
  showConfetti = true,
  dismissLabel = 'Awesome!',
  testID,
}: AchievementUnlockProps): React.ReactElement | null {
  const { colors, isDark } = useTheme();
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animationsEnabled && !reducedMotion && !getReducedMotionPreference();

  // Safe confetti hook (returns null if not in provider)
  const confetti = useConfettiSafe();

  // Animation values - using useState for React Compiler compatibility
  const [animValues] = useState(() => ({
    backdropOpacity: new Animated.Value(0),
    cardScale: new Animated.Value(0.8),
    cardOpacity: new Animated.Value(0),
    badgeScale: new Animated.Value(0),
    contentOpacity: new Animated.Value(0),
  }));

  // Refs for auto-dismiss and confetti
  const autoDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiFiredRef = useRef(false);

  // Themed colors
  const modalColors = useMemo(
    () => ({
      backdrop: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.7)',
      cardBg: colors.surface,
      title: colors.text,
      subtitle: colors.textSecondary,
      glow: colors.primary,
    }),
    [colors, isDark]
  );

  // Run entrance animation when visible
  useEffect(() => {
    if (visible && achievement) {
      // Reset values
      confettiFiredRef.current = false;

      const { backdropOpacity, cardScale, cardOpacity, badgeScale, contentOpacity } = animValues;

      if (shouldAnimate) {
        // Reset to initial values
        backdropOpacity.setValue(0);
        cardScale.setValue(0.8);
        cardOpacity.setValue(0);
        badgeScale.setValue(0);
        contentOpacity.setValue(0);

        // Backdrop fade in
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION.normal,
          useNativeDriver: true,
        }).start();

        // Card entrance with delay
        setTimeout(() => {
          parallel([
            spring(cardScale, 1, { friction: 6, tension: 80, useNativeDriver: true }),
            Animated.timing(cardOpacity, {
              toValue: 1,
              duration: ANIMATION_DURATION.fast,
              useNativeDriver: true,
            }),
          ]).start();
        }, ANIMATION_DELAY / 2);

        // Badge pop-in with delay
        setTimeout(() => {
          spring(badgeScale, 1, { friction: 4, tension: 100, useNativeDriver: true }).start(() => {
            // Fire confetti after badge animation
            if (showConfetti && confetti && !confettiFiredRef.current) {
              confettiFiredRef.current = true;
              setTimeout(() => {
                confetti?.fire({
                  originY: 0.3,
                  particleCount: 80,
                });
              }, 100);
            }
          });
        }, ANIMATION_DELAY);

        // Content fade in
        setTimeout(() => {
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: ANIMATION_DURATION.normal,
            useNativeDriver: true,
          }).start();
        }, ANIMATION_DELAY * 1.5);
      } else {
        // Instant appearance for reduced motion
        backdropOpacity.setValue(1);
        cardScale.setValue(1);
        cardOpacity.setValue(1);
        badgeScale.setValue(1);
        contentOpacity.setValue(1);

        // Still fire confetti if enabled and motion is not reduced
        if (
          showConfetti &&
          confetti &&
          !confettiFiredRef.current &&
          !getReducedMotionPreference()
        ) {
          confettiFiredRef.current = true;
          confetti?.fire({
            originY: 0.3,
            particleCount: 80,
          });
        }
      }
    }
  }, [visible, achievement, shouldAnimate, animValues, showConfetti, confetti]);

  // Handle dismiss with exit animation (defined before auto-dismiss useEffect)
  const handleDismiss = useCallback(() => {
    if (autoDismissTimeoutRef.current) {
      clearTimeout(autoDismissTimeoutRef.current);
    }

    if (shouldAnimate) {
      const { backdropOpacity, cardScale, cardOpacity } = animValues;

      parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.9,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss();
      });
    } else {
      onDismiss();
    }
  }, [shouldAnimate, animValues, onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (visible && autoDismissDelay > 0) {
      autoDismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);
    }

    return () => {
      if (autoDismissTimeoutRef.current) {
        clearTimeout(autoDismissTimeoutRef.current);
      }
    };
  }, [visible, autoDismissDelay, handleDismiss]);

  // Handle backdrop press
  const handleBackdropPress = useCallback(() => {
    handleDismiss();
  }, [handleDismiss]);

  if (!achievement) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
      testID={testID}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                backgroundColor: modalColors.backdrop,
                opacity: animValues.backdropOpacity,
              },
            ]}
          />
        </Pressable>

        {/* Modal Card */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: animValues.cardOpacity,
              transform: [{ scale: animValues.cardScale }],
            },
          ]}
        >
          <Card
            padding="lg"
            elevation="lg"
            backgroundColor={modalColors.cardBg}
            style={styles.card}
          >
            {/* Header text */}
            <Animated.View style={{ opacity: animValues.contentOpacity }}>
              <Text style={[styles.unlockLabel, { color: colors.success }]}>
                Achievement Unlocked!
              </Text>
            </Animated.View>

            {/* Glow effect */}
            <View style={styles.glowContainer}>
              <Animated.View
                style={[
                  styles.glow,
                  {
                    backgroundColor: modalColors.glow,
                    transform: [{ scale: animValues.badgeScale }],
                    opacity: animValues.badgeScale.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.3],
                    }),
                  },
                ]}
              />
            </View>

            {/* Achievement Badge */}
            <Animated.View
              style={[
                styles.badgeContainer,
                {
                  transform: [{ scale: animValues.badgeScale }],
                },
              ]}
            >
              <AchievementBadge
                achievement={achievement}
                size="lg"
                showProgress={false}
                showDescription={false}
              />
            </Animated.View>

            {/* Achievement Name */}
            <Animated.View style={{ opacity: animValues.contentOpacity }}>
              <Text style={[styles.achievementName, { color: modalColors.title }]}>
                {achievement.name}
              </Text>
            </Animated.View>

            {/* Achievement Description */}
            <Animated.View style={{ opacity: animValues.contentOpacity }}>
              <Text style={[styles.achievementDescription, { color: modalColors.subtitle }]}>
                {achievement.description}
              </Text>
            </Animated.View>

            {/* Dismiss Button */}
            <Animated.View style={[styles.buttonContainer, { opacity: animValues.contentOpacity }]}>
              <Button variant="primary" onPress={handleDismiss} accessibilityLabel={dismissLabel}>
                {dismissLabel}
              </Button>
            </Animated.View>
          </Card>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
  },
  cardContainer: {
    position: 'absolute',
    width: '85%',
    maxWidth: 340,
  },
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  unlockLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  glowContainer: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  glow: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  badgeContainer: {
    marginBottom: spacing.md,
    zIndex: 1,
  },
  achievementName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  achievementDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  buttonContainer: {
    minWidth: 150,
  },
});

export default AchievementUnlock;
