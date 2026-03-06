/**
 * AnalyticsScreen
 *
 * Main analytics dashboard screen featuring:
 * - KPI cards (Today's hours, This week, This month, Streak)
 * - Goal progress with overall and per-category tracking
 * - Daily, Weekly, Monthly, and Heatmap charts
 * - Responsive grid layout (2 columns on tablet/desktop, 1 on phone)
 *
 * USAGE:
 * ```tsx
 * // In navigation
 * <Stack.Screen name="Analytics" component={AnalyticsScreen} />
 * ```
 *
 * SECURITY:
 * - All data access is protected by RLS policies
 * - User data is fetched via authenticated hooks
 */

import * as React from 'react';
import { ScrollView, View, StyleSheet, useWindowDimensions, RefreshControl } from 'react-native';

import { KPICards, GoalProgress, getCurrentMonth } from '@/components/analytics';
import {
  ChartContainer,
  DailyChart,
  WeeklyChart,
  MonthlyChart,
  HeatmapChart,
} from '@/components/charts';
import { Text } from '@/components/ui';
import {
  useDailyTotals,
  useWeeklyTotals,
  useMonthlyTotals,
  useHourOfDayDistribution,
  useDayOfWeekDistribution,
} from '@/hooks/useAnalytics';
import { queryClient } from '@/lib/queryClient';
import { colors, spacing } from '@/theme';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Breakpoint for responsive layout */
const TABLET_BREAKPOINT = 768;

/** Number of days for daily chart */
const DAILY_CHART_DAYS = 7;

/** Number of weeks for weekly chart */
const WEEKLY_CHART_WEEKS = 4;

/** Number of months for monthly chart */
const MONTHLY_CHART_MONTHS = 6;

/** Number of days for heatmap */
const HEATMAP_DAYS = 30;

// ============================================================================
// CHART SECTION COMPONENT
// ============================================================================

interface ChartSectionProps {
  /** Whether this section should take half width on tablet */
  halfWidth?: boolean;
  children: React.ReactNode;
}

function ChartSection({ halfWidth, children }: ChartSectionProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  return (
    <View
      style={[
        styles.chartSection,
        isTablet && halfWidth && styles.chartSectionHalf,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AnalyticsScreen component
 *
 * Displays a comprehensive analytics dashboard with:
 * - Key performance indicators
 * - Goal progress tracking
 * - Various time visualization charts
 */
export function AnalyticsScreen(): React.ReactElement {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  // Track refresh state
  const [refreshing, setRefreshing] = React.useState(false);

  // Current month for goal progress
  const currentMonth = getCurrentMonth();

  // Fetch chart data
  const dailyQuery = useDailyTotals({ days: DAILY_CHART_DAYS });
  const weeklyQuery = useWeeklyTotals({ weeks: WEEKLY_CHART_WEEKS });
  const monthlyQuery = useMonthlyTotals({ months: MONTHLY_CHART_MONTHS });
  const hourOfDayQuery = useHourOfDayDistribution({ days: HEATMAP_DAYS });
  const dayOfWeekQuery = useDayOfWeekDistribution({ weeks: 4 });

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Invalidate all analytics queries to force refetch
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
    } finally {
      setRefreshing(false);
    }
  }, []);

  /**
   * Check if all chart data is empty
   */
  const isAllDataEmpty = React.useMemo(() => {
    const dailyEmpty = !dailyQuery.data?.some((d) => d.totalSeconds > 0);
    const weeklyEmpty = !weeklyQuery.data?.some((w) => w.totalSeconds > 0);
    const monthlyEmpty = !monthlyQuery.data?.some((m) => m.totalSeconds > 0);
    return dailyEmpty && weeklyEmpty && monthlyEmpty;
  }, [dailyQuery.data, weeklyQuery.data, monthlyQuery.data]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading">Analytics</Text>
        <Text variant="bodySmall" color="secondary">
          Track your progress and insights
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* KPI Cards Section */}
        <View style={styles.section}>
          <Text variant="label" color="secondary" style={styles.sectionTitle}>
            Overview
          </Text>
          <KPICards />
        </View>

        {/* Goal Progress Section */}
        <View style={styles.section}>
          <Text variant="label" color="secondary" style={styles.sectionTitle}>
            Goal Progress
          </Text>
          <GoalProgress month={currentMonth} />
        </View>

        {/* Charts Section */}
        <View style={styles.section}>
          <Text variant="label" color="secondary" style={styles.sectionTitle}>
            Activity Charts
          </Text>

          <View style={[styles.chartsGrid, isTablet && styles.chartsGridTablet]}>
            {/* Daily Chart */}
            <ChartSection halfWidth>
              <ChartContainer
                title="Last 7 Days"
                subtitle="Daily time tracked"
                isLoading={dailyQuery.isLoading}
                error={dailyQuery.error as Error | null}
                isEmpty={!dailyQuery.data?.some((d) => d.totalSeconds > 0)}
                emptyMessage="No time tracked in the last 7 days"
                minHeight={180}
              >
                {dailyQuery.data && <DailyChart data={dailyQuery.data} />}
              </ChartContainer>
            </ChartSection>

            {/* Weekly Chart */}
            <ChartSection halfWidth>
              <ChartContainer
                title="Last 4 Weeks"
                subtitle="Weekly totals"
                isLoading={weeklyQuery.isLoading}
                error={weeklyQuery.error as Error | null}
                isEmpty={!weeklyQuery.data?.some((w) => w.totalSeconds > 0)}
                emptyMessage="No time tracked in the last 4 weeks"
                minHeight={180}
              >
                {weeklyQuery.data && <WeeklyChart data={weeklyQuery.data} />}
              </ChartContainer>
            </ChartSection>

            {/* Monthly Chart */}
            <ChartSection halfWidth>
              <ChartContainer
                title="Last 6 Months"
                subtitle="Monthly totals"
                isLoading={monthlyQuery.isLoading}
                error={monthlyQuery.error as Error | null}
                isEmpty={!monthlyQuery.data?.some((m) => m.totalSeconds > 0)}
                emptyMessage="No time tracked in the last 6 months"
                minHeight={180}
              >
                {monthlyQuery.data && <MonthlyChart data={monthlyQuery.data} />}
              </ChartContainer>
            </ChartSection>

            {/* Activity Heatmap */}
            <ChartSection halfWidth>
              <ChartContainer
                title="Activity Heatmap"
                subtitle="Time distribution by hour and day"
                isLoading={hourOfDayQuery.isLoading || dayOfWeekQuery.isLoading}
                error={(hourOfDayQuery.error || dayOfWeekQuery.error) as Error | null}
                isEmpty={
                  !hourOfDayQuery.data?.some((h) => h > 0) &&
                  !dayOfWeekQuery.data?.some((d) => d > 0)
                }
                emptyMessage="No activity data yet"
                minHeight={200}
              >
                {hourOfDayQuery.data && dayOfWeekQuery.data && (
                  <HeatmapChart
                    hourData={hourOfDayQuery.data}
                    dayData={dayOfWeekQuery.data}
                  />
                )}
              </ChartContainer>
            </ChartSection>
          </View>
        </View>

        {/* Empty state tip */}
        {isAllDataEmpty && !dailyQuery.isLoading && (
          <View style={styles.emptyTip}>
            <Text variant="bodySmall" color="muted" center>
              Start tracking time to see your analytics populate!
            </Text>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  contentTablet: {
    paddingHorizontal: spacing.lg,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartsGrid: {
    flexDirection: 'column',
  },
  chartsGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  chartSection: {
    marginBottom: spacing.md,
  },
  chartSectionHalf: {
    width: '50%',
    paddingHorizontal: spacing.sm,
  },
  emptyTip: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default AnalyticsScreen;
