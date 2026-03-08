import React, { useMemo } from 'react';
import { colors } from '@/theme';
import type { MonthlyTotal } from '@/hooks/useAnalytics';
import { SimpleBarChart } from './SimpleBarChart';

export interface MonthlyChartProps {
  data: MonthlyTotal[];
  height?: number;
  showTooltips?: boolean;
}

function secondsToHours(s: number) {
  return Math.round((s / 3600) * 10) / 10;
}

function formatMonthShort(month: string) {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

export function MonthlyChart({ data, height = 200 }: MonthlyChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatMonthShort(item.month),
        value: secondsToHours(item.totalSeconds),
        color: colors.success,
      })),
    [data]
  );

  return <SimpleBarChart data={bars} height={height} barColor={colors.success} maxLabels={12} />;
}

export default MonthlyChart;
