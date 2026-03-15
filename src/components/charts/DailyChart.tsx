/**
 * DailyChart - Bar chart showing daily time tracking totals
 *
 * Features:
 * - Animated bars that grow from bottom on mount
 * - Staggered animation for each bar (50ms delay)
 * - Optional total display with count-up animation
 * - Respects reduced motion settings
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { DailyTotal } from '@/hooks/useAnalytics';
import { useCountUpAnimation, formatHoursCountUp } from '@/hooks/useCountUpAnimation';
import { SimpleBarChart } from './SimpleBarChart';

export interface DailyChartProps {
  /** Daily totals data */
  data: DailyTotal[];
  /** Chart height in pixels (default: 200) */
  height?: number;
  /** Show tooltips on hover (not yet implemented) */
  showTooltips?: boolean;
  /** Number of Y-axis ticks (not used, kept for compat) */
  tickCount?: number;
  /** Show animated total at top of chart (default: false) */
  showTotal?: boolean;
  /** Enable bar animations (default: true) */
  animateOnMount?: boolean;
  /** Stagger delay between bars in ms (default: 50) */
  staggerDelay?: number;
}

function secondsToHours(s: number) {
  return Math.round((s / 3600) * 10) / 10;
}

function formatDateAbbreviated(d: string) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DailyChart({
  data,
  height = 200,
  showTotal = false,
  animateOnMount = true,
  staggerDelay = 50,
}: DailyChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatDateAbbreviated(item.date),
        value: secondsToHours(item.totalSeconds),
        color: colors.primary,
      })),
    [data]
  );

  // Calculate total hours for animated counter
  const totalHours = useMemo(
    () => data.reduce((sum, d) => sum + secondsToHours(d.totalSeconds), 0),
    [data]
  );

  // Animated total count-up
  const { displayValue: animatedTotal } = useCountUpAnimation({
    endValue: totalHours,
    duration: 800,
    delay: bars.length * staggerDelay, // Start after bars finish
    formatter: formatHoursCountUp,
    animate: animateOnMount,
  });

  return (
    <View>
      {showTotal && (
        <View style={styles.totalContainer}>
          <Text variant="caption" color="muted">
            Total
          </Text>
          <Text variant="headingSmall" style={styles.totalValue}>
            {animatedTotal}
          </Text>
        </View>
      )}
      <SimpleBarChart
        data={bars}
        height={height}
        barColor={colors.primary}
        maxLabels={7}
        animateOnMount={animateOnMount}
        staggerDelay={staggerDelay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  totalValue: {
    color: colors.primary,
  },
});

export default DailyChart;
