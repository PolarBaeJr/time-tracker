/**
 * KPICards Component
 *
 * Displays key performance indicators for time tracking:
 * - Today's hours
 * - This week's hours
 * - This month's hours
 * - Streak (consecutive days with entries)
 *
 * USAGE:
 * ```tsx
 * import { KPICards } from '@/components/analytics';
 *
 * function Analytics() {
 *   return <KPICards />;
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is displayed
 */

import * as React from 'react';
import { View, StyleSheet, useWindowDimensions, ViewStyle } from 'react-native';

import { Card, Text, Spinner } from '@/components/ui';
import { useDailyTotals, useWeeklyTotals, useMonthlyTotals } from '@/hooks/useAnalytics';
import { colors, spacing } from '@/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface KPICardsProps {
  /** Additional styles for the container */
  style?: ViewStyle;
}

interface KPICardData {
  /** Card title */
  title: string;
  /** Value to display */
  value: string;
  /** Subtitle or secondary info */
  subtitle?: string;
  /** Card color accent */
  accentColor?: string;
  /** Icon character */
  icon?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Breakpoint for responsive layout */
const TABLET_BREAKPOINT = 768;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format seconds as hours with appropriate precision
 */
function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 100) {
    return hours.toFixed(0);
  }
  if (hours >= 10) {
    return hours.toFixed(1);
  }
  return hours.toFixed(1);
}

/**
 * Calculate streak from daily totals
 * A streak is consecutive days with at least some time logged
 */
function calculateStreak(dailyTotals: Array<{ date: string; totalSeconds: number }>): number {
  if (!dailyTotals || dailyTotals.length === 0) {
    return 0;
  }

  // Sort by date descending (newest first)
  const sorted = [...dailyTotals].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Check if today has any time logged
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let currentDate = today;

  for (const entry of sorted) {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);

    // Check if this entry is for the expected date
    const diffDays = Math.floor(
      (currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      // Entry is for the current date
      if (entry.totalSeconds > 0) {
        streak++;
        // Move to previous day
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // No time logged today, but check yesterday
        if (streak === 0) {
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else if (diffDays === 1) {
      // Entry is for the previous expected date
      if (entry.totalSeconds > 0) {
        streak++;
        currentDate = new Date(entryDate);
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    } else {
      // Gap in days, streak is broken
      break;
    }
  }

  return streak;
}

// ============================================================================
// SINGLE KPI CARD COMPONENT
// ============================================================================

interface SingleKPICardProps {
  data: KPICardData;
  isLoading?: boolean;
  style?: ViewStyle;
}

function SingleKPICard({ data, isLoading, style }: SingleKPICardProps): React.ReactElement {
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
 * KPICards component displaying key metrics
 *
 * Fetches data from:
 * - useDailyTotals for today and streak calculation
 * - useWeeklyTotals for this week
 * - useMonthlyTotals for this month
 */
export function KPICards({ style }: KPICardsProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  // Fetch data using analytics hooks
  // Get 30 days for streak calculation
  const { data: dailyData, isLoading: dailyLoading } = useDailyTotals({ days: 30 });
  const { data: weeklyData, isLoading: weeklyLoading } = useWeeklyTotals({ weeks: 1 });
  const { data: monthlyData, isLoading: monthlyLoading } = useMonthlyTotals({ months: 1 });

  // Calculate values
  const todayHours = dailyData?.[0]?.totalSeconds ?? 0;
  const weekHours = weeklyData?.[0]?.totalSeconds ?? 0;
  const monthHours = monthlyData?.[0]?.totalSeconds ?? 0;
  const streak = dailyData ? calculateStreak(dailyData) : 0;

  // Prepare card data
  const cards: KPICardData[] = [
    {
      title: "Today's Hours",
      value: formatHours(todayHours) + 'h',
      icon: '\u23F1', // Stopwatch emoji
      accentColor: colors.primary,
      subtitle: todayHours > 0 ? 'Keep it up!' : 'Start tracking',
    },
    {
      title: "This Week",
      value: formatHours(weekHours) + 'h',
      icon: '\u{1F4C5}', // Calendar emoji
      accentColor: colors.secondary,
      subtitle: weekHours > 28800 ? 'Great week!' : undefined,
    },
    {
      title: "This Month",
      value: formatHours(monthHours) + 'h',
      icon: '\u{1F4CA}', // Chart emoji
      accentColor: colors.success,
    },
    {
      title: "Streak",
      value: streak + (streak === 1 ? ' day' : ' days'),
      icon: '\u{1F525}', // Fire emoji
      accentColor: streak > 0 ? colors.warning : colors.textMuted,
      subtitle: streak >= 7 ? 'On fire!' : streak > 0 ? 'Keep going!' : 'Start your streak',
    },
  ];

  const isLoading = dailyLoading || weeklyLoading || monthlyLoading;

  const containerStyle = StyleSheet.flatten([
    styles.container,
    isTablet ? styles.containerTablet : undefined,
    style,
  ]);

  const getCardWrapperStyle = (index: number): ViewStyle => {
    const baseStyle = isTablet ? styles.cardWrapperTablet : styles.cardWrapperMobile;
    const needsMarginRight = isTablet && index % 2 === 0 && index < cards.length - 1;
    return StyleSheet.flatten([
      styles.cardWrapper,
      baseStyle,
      needsMarginRight ? styles.cardMarginRight : undefined,
    ]);
  };

  return (
    <View style={containerStyle}>
      {cards.map((card, index) => (
        <SingleKPICard
          key={card.title}
          data={card}
          isLoading={isLoading}
          style={getCardWrapperStyle(index)}
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
  },
  containerTablet: {
    flexDirection: 'row',
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  cardWrapperMobile: {
    width: '48%',
    marginRight: '4%',
  },
  cardWrapperTablet: {
    width: '48%',
    marginRight: '4%',
  },
  cardMarginRight: {
    marginRight: '4%',
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

export default KPICards;
