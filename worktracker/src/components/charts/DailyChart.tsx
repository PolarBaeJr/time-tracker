/**
 * DailyChart Component
 *
 * Bar chart showing daily time tracked over the last 30 days.
 * Uses Victory Native for cross-platform charting.
 *
 * USAGE:
 * ```typescript
 * import { DailyChart } from '@/components/charts';
 * import { useDailyTotals } from '@/hooks/useAnalytics';
 *
 * function DailyAnalytics() {
 *   const { data, isLoading, error } = useDailyTotals({ days: 30 });
 *
 *   return (
 *     <ChartContainer isLoading={isLoading} error={error} isEmpty={!data?.length}>
 *       <DailyChart data={data ?? []} />
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
import type { DailyTotal } from '@/hooks/useAnalytics';

// ============================================================================
// TYPES
// ============================================================================

export interface DailyChartProps {
  /** Array of daily totals from useDailyTotals hook */
  data: DailyTotal[];
  /** Chart height (default: 200) */
  height?: number;
  /** Whether to show tooltips on touch (default: true) */
  showTooltips?: boolean;
  /** Number of x-axis tick labels to show (default: 5) */
  tickCount?: number;
}

interface ChartDatum {
  x: number;
  y: number;
  date: string;
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
 * Format date for abbreviated display (e.g., "Mar 5")
 */
function formatDateAbbreviated(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format hours for tooltip display
 */
function formatHoursLabel(hours: number): string {
  if (hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours}h`;
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
        fill: colors.primary,
      },
    },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Bar chart displaying daily time tracking totals
 *
 * Features:
 * - Shows last 30 days of data
 * - X-axis with abbreviated date labels
 * - Y-axis showing hours
 * - Touch tooltips showing exact values
 * - Dark theme styling
 */
export function DailyChart({
  data,
  height = 200,
  showTooltips = true,
  tickCount = 5,
}: DailyChartProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const chartWidth = width - 48; // Account for card padding

  // Transform data for Victory chart (reverse to show oldest first)
  const chartData = useMemo(() => {
    return [...data].reverse().map((item, index) => ({
      x: index,
      y: secondsToHours(item.totalSeconds),
      date: item.date,
      label: `${formatDateAbbreviated(item.date)}\n${formatHoursLabel(secondsToHours(item.totalSeconds))}`,
    }));
  }, [data]);

  // Calculate max Y value for domain
  const maxY = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.y), 1);
    return Math.ceil(max * 1.1); // Add 10% padding
  }, [chartData]);

  // Generate x-axis tick values (evenly distributed)
  const xTickValues = useMemo(() => {
    if (chartData.length === 0) return [];
    const step = Math.max(1, Math.floor(chartData.length / tickCount));
    return chartData
      .filter((_, index) => index % step === 0)
      .map((d) => d.x);
  }, [chartData, tickCount]);

  // Generate x-axis tick labels
  const xTickFormat = useMemo(() => {
    return (tick: number) => {
      const item = chartData.find((d) => d.x === tick);
      return item ? formatDateAbbreviated(item.date) : '';
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
        domainPadding={{ x: 10 }}
        padding={{ top: 20, bottom: 40, left: 45, right: 20 }}
        containerComponent={containerComponent}
      >
        {/* X-Axis (dates) */}
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
          cornerRadius={{ top: 2 }}
          style={{
            data: {
              fill: ({ datum }: { datum: ChartDatum }) => (datum.y > 0 ? colors.primary : colors.surfaceVariant),
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

export default DailyChart;
