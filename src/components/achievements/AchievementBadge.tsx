/**
 * AchievementBadge Component
 *
 * Displays an individual achievement badge with:
 * - Icon, name, and description
 * - Locked/unlocked visual state
 * - Progress bar for partial completion
 * - Animated unlock state
 *
 * Features:
 * - Theme-aware colors
 * - Respects reduced motion settings
 * - Accessible with proper roles
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Animated, StyleSheet, View, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName, iconMap } from '@/components/ui/Icon';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { getReducedMotionPreference, ANIMATION_DURATION, parallel, spring } from '@/lib/animations';
import type { Achievement, AchievementCategory } from '@/schemas/achievement';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the AchievementBadge component
 */
export interface AchievementBadgeProps {
  /** Achievement data to display */
  achievement: Achievement;
  /** Size variant of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the progress bar */
  showProgress?: boolean;
  /** Whether to show description */
  showDescription?: boolean;
  /** Callback when badge is pressed */
  onPress?: (achievement: Achievement) => void;
  /** Whether to animate on mount when unlocked */
  animateUnlock?: boolean;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    containerSize: 80,
    iconSize: 28,
    iconContainerSize: 48,
    nameSize: 11,
    progressBarHeight: 3,
  },
  md: {
    containerSize: 100,
    iconSize: 36,
    iconContainerSize: 60,
    nameSize: 13,
    progressBarHeight: 4,
  },
  lg: {
    containerSize: 120,
    iconSize: 44,
    iconContainerSize: 72,
    nameSize: 15,
    progressBarHeight: 5,
  },
} as const;

/**
 * Category colors for badges
 */
const CATEGORY_COLORS: Record<AchievementCategory, { light: string; dark: string }> = {
  streak: { light: '#F59E0B', dark: '#FBBF24' }, // Amber
  time: { light: '#6366F1', dark: '#818CF8' }, // Indigo
  first: { light: '#10B981', dark: '#34D399' }, // Green
};

/**
 * Map achievement icons to IconName if they exist, otherwise use fallback
 */
function getAchievementIcon(iconName: string): IconName {
  // Check if the icon exists in our iconMap
  const iconKey = iconName as IconName;
  if (iconKey in iconMap) {
    return iconKey;
  }
  // Fallback icons based on common patterns
  if (iconName.includes('fire') || iconName.includes('hot')) {
    return 'sparkles';
  }
  if (iconName.includes('time') || iconName.includes('clock')) {
    return 'time';
  }
  if (iconName.includes('flag')) {
    return 'flag';
  }
  if (iconName.includes('event') || iconName.includes('trophy')) {
    return 'sparkles';
  }
  // Default fallback
  return 'sparkles';
}

// ============================================================================
// ACHIEVEMENT BADGE COMPONENT
// ============================================================================

/**
 * AchievementBadge Component
 *
 * Displays an individual achievement with icon, name, progress, and unlock state.
 *
 * @example
 * ```tsx
 * <AchievementBadge
 *   achievement={achievement}
 *   size="md"
 *   showProgress
 *   onPress={(a) => console.log('Pressed', a.name)}
 * />
 * ```
 */
export function AchievementBadge({
  achievement,
  size = 'md',
  showProgress = true,
  showDescription = false,
  onPress,
  animateUnlock = false,
  testID,
}: AchievementBadgeProps): React.ReactElement {
  const { colors, isDark } = useTheme();
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animationsEnabled && !reducedMotion && !getReducedMotionPreference();

  const config = SIZE_CONFIG[size];

  // Animation values - using useState for React Compiler compatibility
  const [animValues] = useState(() => ({
    scale: new Animated.Value(animateUnlock && achievement.isUnlocked ? 0 : 1),
    opacity: new Animated.Value(animateUnlock && achievement.isUnlocked ? 0 : 1),
    progressWidth: new Animated.Value(0),
    glowOpacity: new Animated.Value(0),
  }));

  // Colors based on state and category
  const badgeColors = useMemo(() => {
    const categoryColor = CATEGORY_COLORS[achievement.category];
    const accent = isDark ? categoryColor.dark : categoryColor.light;

    if (achievement.isUnlocked) {
      return {
        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
        iconBg: accent,
        iconColor: '#FFFFFF',
        text: colors.text,
        textSecondary: colors.textSecondary,
        progressBg: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        progressFill: colors.success,
        border: accent,
      };
    }

    // Locked state
    return {
      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      iconBg: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      iconColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)',
      text: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
      textSecondary: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
      progressBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      progressFill: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)',
      border: 'transparent',
    };
  }, [achievement.isUnlocked, achievement.category, isDark, colors]);

  // Run unlock animation on mount if needed
  useEffect(() => {
    if (animateUnlock && achievement.isUnlocked && shouldAnimate) {
      const { scale, opacity, glowOpacity } = animValues;

      // Pop-in animation
      const unlockAnimation = parallel([
        spring(scale, 1, { friction: 4, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION.normal,
          useNativeDriver: true,
        }),
      ]);

      // Glow pulse
      const glowAnimation = Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION.slow,
          useNativeDriver: true,
        }),
      ]);

      Animated.parallel([unlockAnimation, glowAnimation]).start();
    }
  }, [animateUnlock, achievement.isUnlocked, shouldAnimate, animValues]);

  // Animate progress bar
  useEffect(() => {
    if (showProgress && achievement.progressPercent > 0) {
      if (shouldAnimate) {
        Animated.timing(animValues.progressWidth, {
          toValue: Math.min(achievement.progressPercent, 100),
          duration: ANIMATION_DURATION.slow,
          useNativeDriver: false, // width animation requires JS driver
        }).start();
      } else {
        animValues.progressWidth.setValue(Math.min(achievement.progressPercent, 100));
      }
    }
  }, [showProgress, achievement.progressPercent, shouldAnimate, animValues]);

  // Handle press
  const handlePress = useCallback(() => {
    onPress?.(achievement);
  }, [onPress, achievement]);

  // Progress text
  const progressText = useMemo(() => {
    if (!showProgress || achievement.isUnlocked) return null;
    if (!achievement.targetValue) return null;

    return `${Math.floor(achievement.progress)}/${achievement.targetValue}`;
  }, [showProgress, achievement]);

  const iconName = getAchievementIcon(achievement.icon);

  const content = (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animValues.opacity,
          transform: [{ scale: animValues.scale }],
        },
      ]}
      testID={testID}
    >
      {/* Glow effect for unlock animation */}
      {animateUnlock && achievement.isUnlocked && (
        <Animated.View
          style={[
            styles.glow,
            {
              width: config.iconContainerSize + 20,
              height: config.iconContainerSize + 20,
              borderRadius: (config.iconContainerSize + 20) / 2,
              backgroundColor: badgeColors.border,
              opacity: animValues.glowOpacity,
            },
          ]}
        />
      )}

      {/* Icon Container */}
      <View
        style={[
          styles.iconContainer,
          {
            width: config.iconContainerSize,
            height: config.iconContainerSize,
            borderRadius: config.iconContainerSize / 2,
            backgroundColor: badgeColors.iconBg,
            borderWidth: achievement.isUnlocked ? 2 : 0,
            borderColor: badgeColors.border,
          },
        ]}
      >
        <Icon name={iconName} size={config.iconSize} color={badgeColors.iconColor} />
      </View>

      {/* Name */}
      <Text
        style={[
          styles.name,
          {
            fontSize: config.nameSize,
            color: badgeColors.text,
          },
        ]}
        numberOfLines={2}
      >
        {achievement.name}
      </Text>

      {/* Description */}
      {showDescription && (
        <Text style={[styles.description, { color: badgeColors.textSecondary }]} numberOfLines={2}>
          {achievement.description}
        </Text>
      )}

      {/* Progress Bar */}
      {showProgress && !achievement.isUnlocked && (
        <View
          style={[
            styles.progressContainer,
            {
              height: config.progressBarHeight,
              backgroundColor: badgeColors.progressBg,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                height: config.progressBarHeight,
                backgroundColor: badgeColors.progressFill,
                width: animValues.progressWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}

      {/* Progress Text */}
      {progressText && (
        <Text style={[styles.progressText, { color: badgeColors.textSecondary }]}>
          {progressText}
        </Text>
      )}

      {/* Unlocked indicator */}
      {achievement.isUnlocked && (
        <View style={[styles.unlockedBadge, { backgroundColor: colors.success }]}>
          <Icon name="check" size={10} color="#FFFFFF" />
        </View>
      )}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${achievement.name}. ${achievement.description}. ${
          achievement.isUnlocked
            ? 'Unlocked'
            : `${achievement.progressPercent.toFixed(0)}% complete`
        }`}
        accessibilityState={{ disabled: false }}
        style={({ pressed }) => [styles.pressable, pressed && !shouldAnimate && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  pressable: {
    // No default style
  },
  pressed: {
    opacity: 0.8,
  },
  container: {
    alignItems: 'center',
    padding: spacing.sm,
    width: 100,
  },
  glow: {
    position: 'absolute',
    top: spacing.sm - 10,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  description: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  progressContainer: {
    width: '80%',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.xs / 2,
  },
  progressFill: {
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: 9,
    marginTop: 2,
  },
  unlockedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AchievementBadge;
