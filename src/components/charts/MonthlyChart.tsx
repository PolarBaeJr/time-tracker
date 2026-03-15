/**
 * MonthlyChart - Bar chart showing monthly time tracking totals
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
import type { MonthlyTotal } from '@/hooks/useAnalytics';
import { useCountUpAnimation, formatHoursCountUp } from '@/hooks/useCountUpAnimation';
import { SimpleBarChart } from './SimpleBarChart';

export interface MonthlyChartProps {
  /** Monthly totals data */
  data: MonthlyTotal[];
  /** Chart height in pixels (default: 200) */
  height?: number;
  /** Show tooltips on hover (not yet implemented) */
  showTooltips?: boolean;
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

function formatMonthShort(month: string) {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

export function MonthlyChart({
  data,
  height = 200,
  showTotal = false,
  animateOnMount = true,
  staggerDelay = 50,
}: MonthlyChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatMonthShort(item.month),
        value: secondsToHours(item.totalSeconds),
        color: colors.success,
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
        barColor={colors.success}
        maxLabels={12}
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
    color: colors.success,
  },
});

export default MonthlyChart;
