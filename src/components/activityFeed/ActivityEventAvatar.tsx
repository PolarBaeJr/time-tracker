/**
 * ActivityEventAvatar Component
 *
 * Displays a user avatar with initials fallback for activity feed events.
 * Features:
 * - Initials-based avatar when no image available
 * - Consistent styling with workspace theme
 * - Online indicator support (optional)
 * - Size variants for different contexts
 *
 * USAGE:
 * ```tsx
 * import { ActivityEventAvatar } from '@/components/activityFeed';
 *
 * <ActivityEventAvatar
 *   name="John Doe"
 *   email="john@example.com"
 *   size={40}
 *   showOnlineIndicator
 *   isOnline
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme, fontWeights } from '@/theme';

/**
 * ActivityEventAvatar component props
 */
export interface ActivityEventAvatarProps {
  /** User's display name */
  name: string | null;
  /** User's email (used for initials if name unavailable) */
  email?: string;
  /** Avatar size in pixels (default: 36) */
  size?: number;
  /** Whether to show online indicator */
  showOnlineIndicator?: boolean;
  /** Whether user is currently online */
  isOnline?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Generate initials from name or email
 */
function getInitials(name: string | null, email?: string): string {
  // Try name first
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Fall back to email
  if (email) {
    const localPart = email.split('@')[0];
    return localPart.slice(0, 2).toUpperCase();
  }

  // Default
  return '??';
}

/**
 * Generate a deterministic background color from a string
 * Uses the same set of colors for consistency
 */
function getAvatarColor(identifier: string): string {
  const colors = [
    '#EF4444', // red
    '#F97316', // orange
    '#EAB308', // yellow
    '#22C55E', // green
    '#14B8A6', // teal
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#6366F1', // indigo
    '#06B6D4', // cyan
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * ActivityEventAvatar Component
 *
 * Renders a circular avatar with user initials and optional online indicator.
 */
export function ActivityEventAvatar({
  name,
  email,
  size = 36,
  showOnlineIndicator = false,
  isOnline = false,
  style,
  testID,
}: ActivityEventAvatarProps): React.ReactElement {
  const { colors } = useTheme();

  // Compute initials and background color
  const initials = React.useMemo(() => getInitials(name, email), [name, email]);
  const backgroundColor = React.useMemo(
    () => getAvatarColor(name ?? email ?? 'unknown'),
    [name, email]
  );

  // Online indicator size relative to avatar
  const indicatorSize = Math.max(8, size * 0.25);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}
      testID={testID}
      accessibilityLabel={`Avatar for ${name ?? email ?? 'unknown user'}`}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize: size * 0.4,
          },
        ]}
      >
        {initials}
      </Text>

      {showOnlineIndicator && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: indicatorSize,
              height: indicatorSize,
              borderRadius: indicatorSize / 2,
              backgroundColor: isOnline ? colors.success : colors.textMuted,
              borderColor: colors.background,
            },
          ]}
          accessibilityLabel={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </View>
  );
}

/**
 * ActivityEventAvatarSkeleton Component
 *
 * Loading placeholder for avatar.
 */
export interface ActivityEventAvatarSkeletonProps {
  /** Avatar size (default: 36) */
  size?: number;
}

export function ActivityEventAvatarSkeleton({
  size = 36,
}: ActivityEventAvatarSkeletonProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceVariant,
        },
      ]}
      accessibilityLabel="Loading"
    />
  );
}

// Constant for initials text color
const INITIALS_TEXT_COLOR = '#FFFFFF';

// Constant for online indicator border width
const INDICATOR_BORDER_WIDTH = 2;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  initials: {
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    color: INITIALS_TEXT_COLOR,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: INDICATOR_BORDER_WIDTH,
  },
});

export default ActivityEventAvatar;
