/**
 * WeeklyChart Component
 *
 * Bar chart showing weekly time tracked over the last 12 weeks.
 * Uses Victory Native for cross-platform charting.
 *
 * USAGE:
 * ```typescript
 * import { WeeklyChart } from '@/components/charts';
 * import { useWeeklyTotals } from '@/hooks/useAnalytics';
 *
 * function WeeklyAnalytics() {
 *   const { data, isLoading, error } = useWeeklyTotals({ weeks: 12 });
 *
 *   return (
 *     <ChartContainer isLoading={isLoading} error={error} isEmpty={!data?.length}>
 *       <WeeklyChart data={data ?? []} />
 *     </ChartContainer>
 *   );
 * }
 * ```
 *
 * REQUIRES: victory-native, react-native-svg
 * Install: npx expo install victory-native react-native-svg
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryTheme,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory-native';

import { colors } from '@/theme';
import type { WeeklyTotal } from '@/hooks/useAnalytics';

// ============================================================================
// TYPES
// ============================================================================

export interface WeeklyChartProps {
  /** Array of weekly totals from useWeeklyTotals hook */
  data: WeeklyTotal[];
  /** Chart height (default: 200) */
  height?: number;
  /** Whether to show tooltips on touch (default: true) */
  showTooltips?: boolean;
}

interface ChartDatum {
  x: number;
  y: number;
  weekStart: string;
  label: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert seconds to hours with one decimal place
 */
function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}

/**
 * Format week start date as label (e.g., "Week of Mar 4")
 */
function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  return `W/O ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * Format week as short label for x-axis (e.g., "3/4")
 */
function formatWeekShort(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format hours for tooltip display
 */
function formatHoursLabel(hours: number): string {
  if (hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

// ============================================================================
// CHART THEME
// ============================================================================

/**
 * Dark theme configuration for Victory charts
 */
const chartTheme = {
  ...VictoryTheme.grayscale,
  axis: {
    ...VictoryTheme.grayscale.axis,
    style: {
      axis: { stroke: colors.border, strokeWidth: 1 },
      grid: { stroke: colors.border, strokeWidth: 0.5, strokeDasharray: '4,4' },
      tickLabels: {
        fill: colors.textMuted,
        fontSize: 10,
        fontFamily: 'System',
      },
    },
  },
  bar: {
    style: {
      data: {
        fill: colors.secondary,
      },
    },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Bar chart displaying weekly time tracking totals
 *
 * Features:
 * - Shows last 12 weeks of data
 * - X-axis with week start labels
 * - Y-axis showing hours
 * - Touch tooltips showing exact values
 * - Dark theme styling with secondary color
 */
export function WeeklyChart({
  data,
  height = 200,
  showTooltips = true,
}: WeeklyChartProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const chartWidth = width - 48; // Account for card padding

  // Transform data for Victory chart (reverse to show oldest first)
  const chartData = useMemo(() => {
    return [...data].reverse().map((item, index) => ({
      x: index,
      y: secondsToHours(item.totalSeconds),
      weekStart: item.weekStart,
      label: `${formatWeekLabel(item.weekStart)}\n${formatHoursLabel(secondsToHours(item.totalSeconds))}`,
    }));
  }, [data]);

  // Calculate max Y value for domain
  const maxY = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.y), 1);
    return Math.ceil(max * 1.1); // Add 10% padding
  }, [chartData]);

  // Generate x-axis tick values (show all weeks for 12 weeks)
  const xTickValues = useMemo(() => {
    // Show every other tick if more than 8 weeks
    const step = chartData.length > 8 ? 2 : 1;
    return chartData
      .filter((_, index) => index % step === 0)
      .map((d) => d.x);
  }, [chartData]);

  // Generate x-axis tick labels
  const xTickFormat = useMemo(() => {
    return (tick: number) => {
      const item = chartData.find((d) => d.x === tick);
      return item ? formatWeekShort(item.weekStart) : '';
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return <View style={[styles.container, { height }]} />;
  }

  const containerComponent = showTooltips ? (
    <VictoryVoronoiContainer
      voronoiDimension="x"
      labels={({ datum }: { datum: ChartDatum }) => datum.label}
      labelComponent={
        <VictoryTooltip
          cornerRadius={4}
          flyoutStyle={{
            stroke: colors.border,
            fill: colors.surface,
          }}
          style={{
            fill: colors.text,
            fontSize: 11,
          }}
        />
      }
    />
  ) : undefined;

  return (
    <View style={styles.container}>
      <VictoryChart
        width={chartWidth}
        height={height}
        theme={chartTheme}
        domainPadding={{ x: 15 }}
        padding={{ top: 20, bottom: 40, left: 45, right: 20 }}
        containerComponent={containerComponent}
      >
        {/* X-Axis (week starts) */}
        <VictoryAxis
          tickValues={xTickValues}
          tickFormat={xTickFormat}
          style={{
            tickLabels: {
              angle: -45,
              textAnchor: 'end',
              fontSize: 9,
            },
          }}
        />

        {/* Y-Axis (hours) */}
        <VictoryAxis
          dependentAxis
          domain={[0, maxY]}
          tickFormat={(t: number) => `${t}h`}
          style={{
            grid: { stroke: colors.border, strokeDasharray: '4,4' },
          }}
        />

        {/* Bar chart */}
        <VictoryBar
          data={chartData}
          barRatio={0.7}
          cornerRadius={{ top: 3 }}
          style={{
            data: {
              fill: ({ datum }: { datum: ChartDatum }) => (datum.y > 0 ? colors.secondary : colors.surfaceVariant),
            },
          }}
          animate={{
            duration: 500,
            onLoad: { duration: 300 },
          }}
        />
      </VictoryChart>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});

export default WeeklyChart;
