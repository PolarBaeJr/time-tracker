/**
 * PomodoroStats Component
 *
 * Displays pomodoro-focused statistics including:
 * - Today's pomodoro count and focus time
 * - This week's pomodoro count
 * - Focus vs break time breakdown
 * - Current streak (consecutive days)
 *
 * USAGE:
 * ```tsx
 * import { PomodoroStats } from '@/components/analytics';
 *
 * function Analytics() {
 *   return <PomodoroStats />;
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is displayed
 */

import * as React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';

import { Card, Text, Spinner } from '@/components/ui';
import { usePomodoroStats } from '@/hooks/usePomodoroStats';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface PomodoroStatsProps {
  /** Additional styles for the container */
  style?: ViewStyle;
}

interface StatCardData {
  title: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  icon?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format seconds into a human-readable duration string
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

// ============================================================================
// SINGLE STAT CARD
// ============================================================================

interface SingleStatCardProps {
  data: StatCardData;
  isLoading?: boolean;
  style?: ViewStyle;
}

function SingleStatCard({ data, isLoading, style }: SingleStatCardProps): React.ReactElement {
  const cardStyle = StyleSheet.flatten([styles.card, style]);
  const valueStyle = data.accentColor
    ? StyleSheet.flatten([styles.cardValue, { color: data.accentColor }])
    : styles.cardValue;

  return (
    <Card padding="md" elevation="sm" style={cardStyle}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Spinner size="small" />
        </View>
      ) : (
        <>
          <View style={styles.cardHeader}>
            {data.icon && (
              <Text variant="headingSmall" style={styles.cardIcon}>
                {data.icon}
              </Text>
            )}
            <Text variant="caption" color="muted" style={styles.cardTitle}>
              {data.title}
            </Text>
          </View>
          <Text variant="heading" style={valueStyle}>
            {data.value}
          </Text>
          {data.subtitle && (
            <Text variant="caption" color="secondary">
              {data.subtitle}
            </Text>
          )}
        </>
      )}
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PomodoroStats component displaying pomodoro-focused metrics
 *
 * Fetches data via usePomodoroStats and displays:
 * - Today's pomodoro count and focus time
 * - This week's pomodoro count
 * - Focus vs break ratio
 * - Current streak
 */
export function PomodoroStats({ style }: PomodoroStatsProps): React.ReactElement {
  const { colors } = useTheme();
  const { data, isLoading } = usePomodoroStats();

  const pomodorosToday = data?.pomodorosToday ?? 0;
  const focusTimeToday = data?.focusTimeToday ?? 0;
  const breakTimeToday = data?.breakTimeToday ?? 0;
  const pomodorosThisWeek = data?.pomodorosThisWeek ?? 0;
  const currentStreak = data?.currentStreak ?? 0;

  // Focus vs break ratio
  const totalTime = focusTimeToday + breakTimeToday;
  const focusPercent = totalTime > 0 ? Math.round((focusTimeToday / totalTime) * 100) : 0;

  const cards: StatCardData[] = [
    {
      title: 'Today',
      value: String(pomodorosToday),
      icon: '\u{1F345}', // Tomato emoji
      accentColor: colors.error,
      subtitle: focusTimeToday > 0 ? formatDuration(focusTimeToday) + ' focus' : 'No sessions yet',
    },
    {
      title: 'This Week',
      value: String(pomodorosThisWeek),
      icon: '\u{1F4C5}', // Calendar emoji
      accentColor: colors.secondary,
      subtitle: pomodorosThisWeek > 0 ? `${(pomodorosThisWeek / 7).toFixed(1)}/day avg` : undefined,
    },
    {
      title: 'Focus Ratio',
      value: totalTime > 0 ? `${focusPercent}%` : '--',
      icon: '\u{1F3AF}', // Target emoji
      accentColor: colors.primary,
      subtitle:
        totalTime > 0
          ? `${formatDuration(focusTimeToday)} / ${formatDuration(breakTimeToday)}`
          : 'No data today',
    },
    {
      title: 'Streak',
      value: currentStreak + (currentStreak === 1 ? ' day' : ' days'),
      icon: '\u{1F525}', // Fire emoji
      accentColor: currentStreak > 0 ? colors.warning : colors.textMuted,
      subtitle:
        currentStreak >= 7 ? 'On fire!' : currentStreak > 0 ? 'Keep going!' : 'Start your streak',
    },
  ];

  return (
    <View style={StyleSheet.flatten([styles.container, style])}>
      {cards.map(card => (
        <SingleStatCard
          key={card.title}
          data={card}
          isLoading={isLoading}
          style={styles.cardWrapper}
        />
      ))}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardWrapper: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
  },
  card: {
    minHeight: 100,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardIcon: {
    marginRight: spacing.xs,
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    ...Platform.select({
      ios: { letterSpacing: 0.5 },
      default: { letterSpacing: 0.5 },
      android: {},
    }),
  },
  cardValue: {
    marginVertical: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
  },
});

export default PomodoroStats;
