/**
 * PublicProfileCard Component
 *
 * Displays public profile statistics in a card layout.
 * Shows user name, total hours badge, category breakdown,
 * streak counter, and goals completed counter.
 * Responsive design for various screen sizes.
 */

import * as React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { Text, Card, Icon, type IconName } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import type { PublicProfile, PublicProfileStats } from '@/hooks/usePublicProfile';

/**
 * Props for PublicProfileCard component
 */
export interface PublicProfileCardProps {
  /** Public profile data */
  profile: PublicProfile;
  /** Show compact version */
  compact?: boolean;
}

/**
 * Stat badge component for displaying individual stats
 */
function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  color?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  const badgeColor = color || colors.primary;

  return (
    <View style={styles.statBadge}>
      <View style={[styles.statIconContainer, { backgroundColor: badgeColor + '20' }]}>
        <Icon name={icon} size={20} color={badgeColor} />
      </View>
      <Text variant="caption" style={{ color: colors.textMuted, marginTop: spacing.xs }}>
        {label}
      </Text>
      <Text variant="heading" style={{ color: colors.text }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Category breakdown pie chart visualization
 */
function CategoryBreakdown({ stats }: { stats: PublicProfileStats }): React.ReactElement {
  const { colors } = useTheme();

  // Calculate percentages
  const total =
    stats.category_breakdown.work +
    stats.category_breakdown.break +
    stats.category_breakdown.long_break;

  if (total === 0) {
    return (
      <View style={styles.categorySection}>
        <Text variant="label" style={{ color: colors.text, marginBottom: spacing.sm }}>
          Time Distribution
        </Text>
        <Text variant="body" style={{ color: colors.textMuted }}>
          No data available
        </Text>
      </View>
    );
  }

  const workPercent = Math.round((stats.category_breakdown.work / total) * 100);
  const breakPercent = Math.round((stats.category_breakdown.break / total) * 100);
  const longBreakPercent = 100 - workPercent - breakPercent;

  const categories = [
    { label: 'Work', percent: workPercent, color: colors.primary },
    { label: 'Break', percent: breakPercent, color: colors.success },
    { label: 'Long Break', percent: longBreakPercent, color: colors.warning },
  ].filter(c => c.percent > 0);

  return (
    <View style={styles.categorySection}>
      <Text variant="label" style={{ color: colors.text, marginBottom: spacing.sm }}>
        Time Distribution
      </Text>

      {/* Progress bar visualization */}
      <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
        {categories.map((category, index) => (
          <View
            key={category.label}
            style={[
              styles.progressSegment,
              {
                width: `${category.percent}%`,
                backgroundColor: category.color,
                borderTopLeftRadius: index === 0 ? borderRadius.sm : 0,
                borderBottomLeftRadius: index === 0 ? borderRadius.sm : 0,
                borderTopRightRadius: index === categories.length - 1 ? borderRadius.sm : 0,
                borderBottomRightRadius: index === categories.length - 1 ? borderRadius.sm : 0,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {categories.map(category => (
          <View key={category.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: category.color }]} />
            <Text variant="caption" style={{ color: colors.textSecondary }}>
              {category.label} ({category.percent}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Format hours for display
 */
function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 10) {
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(hours)}h`;
}

/**
 * PublicProfileCard component
 *
 * @example
 * ```tsx
 * <PublicProfileCard
 *   profile={{
 *     name: 'John Doe',
 *     stats: {
 *       total_hours: 150.5,
 *       category_breakdown: { work: 80, break: 15, long_break: 5 },
 *       current_streak: 7,
 *       goals_completed: 12,
 *     },
 *   }}
 * />
 * ```
 */
export function PublicProfileCard({
  profile,
  compact = false,
}: PublicProfileCardProps): React.ReactElement {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  // Responsive grid layout
  const isWide = width > 600;
  const statGridStyle = isWide ? styles.statGridWide : styles.statGridNarrow;

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <Card style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Icon name="user" size={40} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text variant="heading" style={{ color: colors.text }}>
              {profile.name || 'Anonymous'}
            </Text>
            <View style={styles.totalHoursBadge}>
              <Icon name="clock" size={14} color={colors.primary} />
              <Text variant="body" bold style={{ color: colors.primary, marginLeft: spacing.xs }}>
                {formatHours(profile.stats.total_hours)} total
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Stats Grid */}
      <View style={[styles.statGrid, statGridStyle]}>
        <StatBadge
          icon="clock"
          label="Total Hours"
          value={formatHours(profile.stats.total_hours)}
          color={colors.primary}
        />
        <StatBadge
          icon="star"
          label="Current Streak"
          value={`${profile.stats.current_streak} days`}
          color={colors.warning}
        />
        <StatBadge
          icon="flag"
          label="Goals Completed"
          value={profile.stats.goals_completed}
          color={colors.success}
        />
        <StatBadge
          icon="trending-up"
          label="Daily Average"
          value={
            profile.stats.total_hours > 0 && profile.stats.current_streak > 0
              ? formatHours(profile.stats.total_hours / Math.max(profile.stats.current_streak, 1))
              : '0h'
          }
          color={colors.secondary}
        />
      </View>

      {/* Category Breakdown */}
      {!compact && (
        <Card style={styles.categoryCard}>
          <CategoryBreakdown stats={profile.stats} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  headerCard: {
    padding: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  totalHoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statGridNarrow: {
    // 2 columns on narrow screens
  },
  statGridWide: {
    // 4 columns on wide screens
  },
  statBadge: {
    flex: 1,
    minWidth: 140,
    backgroundColor: 'transparent',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySection: {
    // Category breakdown section
  },
  categoryCard: {
    padding: spacing.md,
  },
  progressBar: {
    height: 12,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default PublicProfileCard;
