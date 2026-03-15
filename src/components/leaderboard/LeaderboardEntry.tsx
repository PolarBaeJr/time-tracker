/**
 * LeaderboardEntry Component
 *
 * Displays a single leaderboard entry with rank, user info, and time.
 * Features:
 * - Medal icons for top 3 ranks (gold, silver, bronze)
 * - User avatar with initials fallback
 * - Formatted duration (Xh Ym)
 * - Progress bar relative to leader
 * - Highlight style for current user
 *
 * USAGE:
 * ```tsx
 * import { LeaderboardEntry } from '@/components/leaderboard';
 *
 * <LeaderboardEntry
 *   entry={leaderboardEntry}
 *   leaderSeconds={maxSeconds}
 *   isCurrentUser={entry.is_current_user}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text, Skeleton } from '@/components/ui';
import { useTheme, spacing, borderRadius, fontSizes, fontWeights } from '@/theme';
import { type LeaderboardEntry as LeaderboardEntryType, RANK_BADGES } from '@/schemas';
import {
  formatLeaderboardDuration,
  getRankBadge,
  getProgressPercentage,
} from '@/hooks/useLeaderboard';

/**
 * LeaderboardEntry component props
 */
export interface LeaderboardEntryProps {
  /** The leaderboard entry data */
  entry: LeaderboardEntryType;
  /** Leader's total seconds (for progress bar calculation) */
  leaderSeconds: number;
  /** Whether this entry is the current user */
  isCurrentUser?: boolean;
  /** Whether to show progress bar */
  showProgress?: boolean;
  /** Compact mode for widget display */
  compact?: boolean;
}

/**
 * Medal badge colors
 */
const MEDAL_COLORS = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
} as const;

/**
 * Medal emoji for ranks 1-3
 */
const MEDAL_EMOJI = {
  gold: '\u{1F947}', // 🥇
  silver: '\u{1F948}', // 🥈
  bronze: '\u{1F949}', // 🥉
} as const;

/**
 * Avatar component with initials fallback
 */
interface AvatarProps {
  name: string;
  size: number;
}

function Avatar({ name, size }: AvatarProps): React.ReactElement {
  const { colors } = useTheme();

  // Generate initials from name
  const initials = React.useMemo(() => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceVariant,
        },
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          {
            fontSize: size * 0.4,
            color: colors.textSecondary,
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

/**
 * Rank display component with medal for top 3
 */
interface RankDisplayProps {
  rank: number;
  compact?: boolean;
}

function RankDisplay({ rank, compact = false }: RankDisplayProps): React.ReactElement {
  const { colors } = useTheme();
  const badge = getRankBadge(rank);

  const size = compact ? 24 : 32;

  if (badge) {
    // Show medal emoji for top 3
    return (
      <View style={[styles.rankContainer, { width: size, height: size }]}>
        <Text style={[styles.medalEmoji, { fontSize: compact ? 16 : 20 }]}>
          {MEDAL_EMOJI[badge]}
        </Text>
      </View>
    );
  }

  // Show numeric rank for 4+
  return (
    <View style={[styles.rankContainer, { width: size, height: size }]}>
      <Text
        style={[
          styles.rankNumber,
          {
            fontSize: compact ? fontSizes.sm : fontSizes.md,
            color: colors.textSecondary,
          },
        ]}
      >
        {rank}
      </Text>
    </View>
  );
}

/**
 * Progress bar component
 */
interface ProgressBarProps {
  percentage: number;
}

function ProgressBar({ percentage }: ProgressBarProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.progressContainer, { backgroundColor: colors.surfaceVariant }]}>
      <View
        style={[
          styles.progressBar,
          {
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

/**
 * LeaderboardEntry Component
 *
 * Renders a single entry in the leaderboard with rank, avatar, name,
 * duration, and optional progress bar.
 */
export function LeaderboardEntry({
  entry,
  leaderSeconds,
  isCurrentUser = false,
  showProgress = true,
  compact = false,
}: LeaderboardEntryProps): React.ReactElement {
  const { colors } = useTheme();

  const progressPercentage = getProgressPercentage(entry.total_seconds, leaderSeconds);
  const formattedDuration = formatLeaderboardDuration(entry.total_seconds);

  const isHighlighted = isCurrentUser || entry.is_current_user;

  const containerStyle = StyleSheet.flatten([
    styles.container,
    compact ? styles.containerCompact : undefined,
    isHighlighted
      ? {
          backgroundColor: `${colors.primary}15`,
          borderColor: colors.primary,
          borderWidth: 1,
        }
      : undefined,
  ]);

  return (
    <View
      style={containerStyle}
      accessibilityLabel={`Rank ${entry.rank}: ${entry.name}, ${formattedDuration}${isCurrentUser ? ', you' : ''}`}
    >
      {/* Rank */}
      <RankDisplay rank={entry.rank} compact={compact} />

      {/* Avatar */}
      <Avatar name={entry.name} size={compact ? 28 : 36} />

      {/* Name and Progress */}
      <View style={styles.infoContainer}>
        <Text
          variant={compact ? 'bodySmall' : 'body'}
          numberOfLines={1}
          style={[
            styles.name,
            (isCurrentUser || entry.is_current_user) && { fontWeight: fontWeights.semibold },
          ]}
        >
          {entry.name}
          {(isCurrentUser || entry.is_current_user) && (
            <Text variant="caption" color="secondary">
              {' '}
              (You)
            </Text>
          )}
        </Text>

        {showProgress && !compact && <ProgressBar percentage={progressPercentage} />}
      </View>

      {/* Duration */}
      <View style={styles.durationContainer}>
        <Text
          variant={compact ? 'caption' : 'label'}
          style={[
            styles.duration,
            { color: colors.text },
            (isCurrentUser || entry.is_current_user) && { color: colors.primary },
          ]}
        >
          {formattedDuration}
        </Text>
        {!compact && (
          <Text variant="caption" color="secondary">
            {progressPercentage}%
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * LeaderboardEntrySkeleton Component
 *
 * Loading placeholder for leaderboard entry.
 */
export interface LeaderboardEntrySkeletonProps {
  compact?: boolean;
}

export function LeaderboardEntrySkeleton({
  compact = false,
}: LeaderboardEntrySkeletonProps): React.ReactElement {
  const avatarSize = compact ? 28 : 36;
  const rankSize = compact ? 24 : 32;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Rank skeleton */}
      <Skeleton
        variant="rectangle"
        width={rankSize}
        height={rankSize}
        borderRadius={borderRadius.sm}
      />

      {/* Avatar skeleton */}
      <Skeleton variant="circle" width={avatarSize} height={avatarSize} />

      {/* Name and progress skeleton */}
      <View style={styles.infoContainer}>
        <Skeleton variant="text" width="70%" height={compact ? 14 : 16} />
        {!compact && (
          <Skeleton
            variant="rectangle"
            width="100%"
            height={4}
            borderRadius={2}
            style={styles.progressSkeleton}
          />
        )}
      </View>

      {/* Duration skeleton */}
      <View style={styles.durationContainer}>
        <Skeleton variant="text" width={50} height={compact ? 12 : 14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  containerCompact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  rankContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontWeight: fontWeights.bold,
  },
  medalEmoji: {
    textAlign: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: fontWeights.semibold,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  name: {
    // Additional styles applied inline
  },
  progressContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressSkeleton: {
    marginTop: spacing.xs,
  },
  durationContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  duration: {
    fontWeight: fontWeights.semibold,
  },
});

export default LeaderboardEntry;
