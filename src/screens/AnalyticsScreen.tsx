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
import {
  ScrollView,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

import {
  KPICards,
  GoalProgress,
  getCurrentMonth,
  PomodoroStats,
  DashboardWidgetWrapper,
  DashboardEditPanel,
} from '@/components/analytics';
import {
  ChartContainer,
  DailyChart,
  WeeklyChart,
  MonthlyChart,
  HeatmapChart,
} from '@/components/charts';
import { Text, Icon } from '@/components/ui';
import {
  useDailyTotals,
  useWeeklyTotals,
  useMonthlyTotals,
  useHourOfDayDistribution,
  useDayOfWeekDistribution,
} from '@/hooks/useAnalytics';
import { queryClient } from '@/lib/queryClient';
import { useDashboardLayout, setWidgetOrder, setEditMode } from '@/stores';
import type { DashboardWidgetId } from '@/stores';
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
// MAIN COMPONENT
// ============================================================================

/**
 * AnalyticsScreen component
 *
 * Displays a customizable analytics dashboard with:
 * - Key performance indicators
 * - Goal progress tracking
 * - Various time visualization charts
 * - Drag-and-drop widget reordering
 */
export function AnalyticsScreen(): React.ReactElement {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const { widgets, isEditMode } = useDashboardLayout();
  const visibleWidgets = widgets.filter(w => w.visible);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

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

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const isAllDataEmpty = React.useMemo(() => {
    const dailyEmpty = !dailyQuery.data?.some(d => d.totalSeconds > 0);
    const weeklyEmpty = !weeklyQuery.data?.some(w => w.totalSeconds > 0);
    const monthlyEmpty = !monthlyQuery.data?.some(m => m.totalSeconds > 0);
    return dailyEmpty && weeklyEmpty && monthlyEmpty;
  }, [dailyQuery.data, weeklyQuery.data, monthlyQuery.data]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = widgets.findIndex(w => w.id === active.id);
      const newIndex = widgets.findIndex(w => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      setWidgetOrder(arrayMove(widgets, oldIndex, newIndex));
    },
    [widgets]
  );

  const renderWidget = (id: DashboardWidgetId): React.ReactNode => {
    switch (id) {
      case 'kpi':
        return (
          <View style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionTitle}>
              Overview
            </Text>
            <KPICards />
          </View>
        );
      case 'pomodoro':
        return (
          <View style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionTitle}>
              Pomodoro
            </Text>
            <PomodoroStats />
          </View>
        );
      case 'goals':
        return (
          <View style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionTitle}>
              Goal Progress
            </Text>
            <GoalProgress month={currentMonth} />
          </View>
        );
      case 'daily-chart':
        return (
          <View style={styles.section}>
            <ChartContainer
              title="Last 7 Days"
              subtitle="Daily time tracked"
              isLoading={dailyQuery.isLoading}
              error={dailyQuery.error as Error | null}
              isEmpty={!dailyQuery.data?.some(d => d.totalSeconds > 0)}
              emptyMessage="No time tracked in the last 7 days"
              minHeight={180}
            >
              {dailyQuery.data && <DailyChart data={dailyQuery.data} />}
            </ChartContainer>
          </View>
        );
      case 'weekly-chart':
        return (
          <View style={styles.section}>
            <ChartContainer
              title="Last 4 Weeks"
              subtitle="Weekly totals"
              isLoading={weeklyQuery.isLoading}
              error={weeklyQuery.error as Error | null}
              isEmpty={!weeklyQuery.data?.some(w => w.totalSeconds > 0)}
              emptyMessage="No time tracked in the last 4 weeks"
              minHeight={180}
            >
              {weeklyQuery.data && <WeeklyChart data={weeklyQuery.data} />}
            </ChartContainer>
          </View>
        );
      case 'monthly-chart':
        return (
          <View style={styles.section}>
            <ChartContainer
              title="Last 6 Months"
              subtitle="Monthly totals"
              isLoading={monthlyQuery.isLoading}
              error={monthlyQuery.error as Error | null}
              isEmpty={!monthlyQuery.data?.some(m => m.totalSeconds > 0)}
              emptyMessage="No time tracked in the last 6 months"
              minHeight={180}
            >
              {monthlyQuery.data && <MonthlyChart data={monthlyQuery.data} />}
            </ChartContainer>
          </View>
        );
      case 'heatmap':
        return (
          <View style={styles.section}>
            <ChartContainer
              title="Activity Heatmap"
              subtitle="Time distribution by hour and day"
              isLoading={hourOfDayQuery.isLoading || dayOfWeekQuery.isLoading}
              error={(hourOfDayQuery.error || dayOfWeekQuery.error) as Error | null}
              isEmpty={
                !hourOfDayQuery.data?.some(h => h > 0) && !dayOfWeekQuery.data?.some(d => d > 0)
              }
              emptyMessage="No activity data yet"
              minHeight={200}
            >
              {hourOfDayQuery.data && dayOfWeekQuery.data && (
                <HeatmapChart hourData={hourOfDayQuery.data} dayData={dayOfWeekQuery.data} />
              )}
            </ChartContainer>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text variant="heading">Analytics</Text>
            <Text variant="bodySmall" color="secondary">
              Track your progress and insights
            </Text>
          </View>
          <Pressable
            onPress={() => setEditMode(!isEditMode)}
            style={styles.editButton}
            accessibilityLabel="Customize dashboard"
            accessibilityRole="button"
          >
            <Icon
              name="settings"
              size={20}
              color={isEditMode ? colors.primary : colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
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
        {isEditMode && <DashboardEditPanel />}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visibleWidgets.map(w => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {visibleWidgets.map(widget => (
              <DashboardWidgetWrapper key={widget.id} id={widget.id} isEditMode={isEditMode}>
                {renderWidget(widget.id)}
              </DashboardWidgetWrapper>
            ))}
          </SortableContext>
        </DndContext>

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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  editButton: {
    padding: spacing.sm,
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
