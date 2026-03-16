/**
 * SharedDashboardViewer Component
 *
 * Read-only analytics view for shared dashboards.
 * Shows daily totals chart, category breakdown, and summary cards.
 * Responsive for embedding, includes "Powered by WorkTracker" branding.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';

import { Text, Icon, Card, Spinner, type IconName } from '@/components/ui';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import type { SharedDashboardData, DailyTotal, CategoryBreakdown } from '@/schemas';
import { formatDuration, secondsToHours } from '@/hooks/useSharedDashboardView';

/**
 * Props for SharedDashboardViewer component
 */
export interface SharedDashboardViewerProps {
  /** Dashboard data to display */
  data: SharedDashboardData;
  /** Date range start (optional, for display) */
  startDate?: string;
  /** Date range end (optional, for display) */
  endDate?: string;
  /** Callback when date range changes */
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  /** Show compact version (for embedding) */
  compact?: boolean;
}

/**
 * Summary card component
 */

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: IconName;
}): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryCardHeader}>
        <Icon name={icon} size={20} color={colors.primary} />
        <Text variant="caption" style={{ color: colors.textSecondary, marginLeft: spacing.xs }}>
          {title}
        </Text>
      </View>
      <Text variant="heading" style={{ color: colors.text, marginTop: spacing.xs }}>
        {value}
      </Text>
      {subtitle && (
        <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
    </Card>
  );
}

/**
 * Daily chart bar component
 */
function DailyBar({
  total,
  maxValue,
  date,
  isToday,
}: {
  total: DailyTotal;
  maxValue: number;
  date: string;
  isToday: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const height = maxValue > 0 ? (total.total_seconds / maxValue) * 100 : 0;

  // Get day of week abbreviation
  const dayAbbrev = new Date(total.date).toLocaleDateString(undefined, { weekday: 'short' });

  return (
    <View style={styles.barContainer}>
      <View style={styles.barWrapper}>
        <View
          style={[
            styles.bar,
            {
              height: `${Math.max(height, 2)}%`,
              backgroundColor: isToday ? colors.primary : colors.primary + '80',
              borderRadius: borderRadius.sm,
            },
          ]}
        />
      </View>
      <Text
        variant="caption"
        style={{ color: isToday ? colors.primary : colors.textMuted, marginTop: 4 }}
      >
        {dayAbbrev}
      </Text>
    </View>
  );
}

/**
 * Daily totals chart component
 */
function DailyTotalsChart({ dailyTotals }: { dailyTotals: DailyTotal[] }): React.ReactElement {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  // Get last 14 days or all available
  const recentTotals = dailyTotals.slice(-14);

  // Find max value for scaling
  const maxValue = Math.max(...recentTotals.map(d => d.total_seconds), 1);

  // Get today's date for highlighting
  const today = new Date().toISOString().split('T')[0];

  if (recentTotals.length === 0) {
    return (
      <Card style={styles.chartCard}>
        <Text variant="label" style={{ color: colors.text, marginBottom: spacing.md }}>
          Daily Activity
        </Text>
        <View style={styles.emptyChart}>
          <Text variant="body" style={{ color: colors.textMuted }}>
            No data for this period
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.chartCard}>
      <Text variant="label" style={{ color: colors.text, marginBottom: spacing.md }}>
        Daily Activity
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartContainer}>
          {recentTotals.map(total => (
            <DailyBar
              key={total.date}
              total={total}
              maxValue={maxValue}
              date={total.date}
              isToday={total.date === today}
            />
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

/**
 * Category breakdown item component
 */
function CategoryItem({ category }: { category: CategoryBreakdown }): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.categoryItem}>
      <View style={styles.categoryInfo}>
        <View style={[styles.categoryDot, { backgroundColor: category.category_color }]} />
        <Text variant="body" style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
          {category.category_name}
        </Text>
      </View>
      <View style={styles.categoryStats}>
        <Text variant="body" bold style={{ color: colors.text }}>
          {formatDuration(category.total_seconds)}
        </Text>
        <Text variant="caption" style={{ color: colors.textMuted, marginLeft: spacing.xs }}>
          ({Math.round(category.percentage)}%)
        </Text>
      </View>
    </View>
  );
}

/**
 * Category breakdown chart component
 */
function CategoryBreakdownChart({
  categories,
}: {
  categories: CategoryBreakdown[];
}): React.ReactElement {
  const { colors } = useTheme();

  if (categories.length === 0) {
    return (
      <Card style={styles.categoryCard}>
        <Text variant="label" style={{ color: colors.text, marginBottom: spacing.md }}>
          Time by Category
        </Text>
        <View style={styles.emptyChart}>
          <Text variant="body" style={{ color: colors.textMuted }}>
            No categories tracked
          </Text>
        </View>
      </Card>
    );
  }

  // Sort by total time descending
  const sortedCategories = [...categories].sort((a, b) => b.total_seconds - a.total_seconds);

  // Show progress bar visualization
  const totalSeconds = categories.reduce((sum, c) => sum + c.total_seconds, 0);

  return (
    <Card style={styles.categoryCard}>
      <Text variant="label" style={{ color: colors.text, marginBottom: spacing.md }}>
        Time by Category
      </Text>

      {/* Stacked progress bar */}
      <View
        style={[
          styles.progressBar,
          { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.sm },
        ]}
      >
        {sortedCategories.map((category, index) => {
          const width = totalSeconds > 0 ? (category.total_seconds / totalSeconds) * 100 : 0;
          return (
            <View
              key={category.category_id ?? `uncategorized-${index}`}
              style={[
                styles.progressSegment,
                {
                  width: `${width}%`,
                  backgroundColor: category.category_color,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Category list */}
      <View style={styles.categoryList}>
        {sortedCategories.slice(0, 5).map((category, index) => (
          <CategoryItem
            key={category.category_id ?? `uncategorized-${index}`}
            category={category}
          />
        ))}
        {sortedCategories.length > 5 && (
          <Text
            variant="caption"
            style={{ color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}
          >
            +{sortedCategories.length - 5} more categories
          </Text>
        )}
      </View>
    </Card>
  );
}

/**
 * Date range display component
 */
function DateRangeDisplay({
  dateRange,
}: {
  dateRange: { start: string; end: string };
}): React.ReactElement {
  const { colors } = useTheme();

  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={styles.dateRangeContainer}>
      <Icon name="calendar" size={16} color={colors.textMuted} />
      <Text variant="caption" style={{ color: colors.textSecondary, marginLeft: spacing.xs }}>
        {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
      </Text>
    </View>
  );
}

/**
 * Branding footer component
 */
function BrandingFooter(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.brandingFooter}>
      <Text variant="caption" style={{ color: colors.textMuted }}>
        Powered by{' '}
        <Text variant="caption" bold style={{ color: colors.primary }}>
          WorkTracker
        </Text>
      </Text>
    </View>
  );
}

/**
 * SharedDashboardViewer component
 *
 * Displays read-only analytics for a shared dashboard.
 */
export function SharedDashboardViewer({
  data,
  startDate,
  endDate,
  onDateRangeChange,
  compact = false,
}: SharedDashboardViewerProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={{ color: colors.text }}>
          {data.title}
        </Text>
        {data.owner_name && (
          <Text variant="caption" style={{ color: colors.textMuted, marginTop: spacing.xs }}>
            by {data.owner_name}
          </Text>
        )}
        {data.workspace_name && (
          <View style={styles.workspaceBadge}>
            <Icon name="users" size={12} color={colors.textSecondary} />
            <Text variant="caption" style={{ color: colors.textSecondary, marginLeft: 4 }}>
              {data.workspace_name}
            </Text>
          </View>
        )}
        <DateRangeDisplay dateRange={data.date_range} />
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <SummaryCard
          title="This Week"
          value={`${secondsToHours(data.summary.total_hours_week * 3600)}h`}
          icon="clock"
        />
        <SummaryCard
          title="This Month"
          value={`${secondsToHours(data.summary.total_hours_month * 3600)}h`}
          icon="calendar"
        />
      </View>
      <View style={styles.summaryRow}>
        <SummaryCard
          title="Daily Avg"
          value={`${data.summary.avg_hours_per_day.toFixed(1)}h`}
          icon="trending-up"
        />
        <SummaryCard
          title="Days Tracked"
          value={`${data.summary.days_tracked}`}
          icon="check-circle"
        />
      </View>

      {/* Daily Totals Chart */}
      {!compact && <DailyTotalsChart dailyTotals={data.daily_totals} />}

      {/* Category Breakdown */}
      <CategoryBreakdownChart categories={data.category_breakdown} />

      {/* Generated timestamp */}
      <Text
        variant="caption"
        style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }}
      >
        Last updated: {new Date(data.generated_at).toLocaleString()}
      </Text>

      {/* Branding Footer */}
      <BrandingFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  workspaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 4,
  },
  barContainer: {
    alignItems: 'center',
    width: 32,
  },
  barWrapper: {
    height: 100,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 2,
  },
  emptyChart: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressSegment: {
    height: '100%',
  },
  categoryList: {
    gap: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandingFooter: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
});
