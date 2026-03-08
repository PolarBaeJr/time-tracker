import React, { useMemo } from 'react';
import { colors } from '@/theme';
import type { MonthlyEarningsEntry } from '@/hooks/useAnalytics';
import { SimpleBarChart } from './SimpleBarChart';

export interface EarningsChartProps {
  data: MonthlyEarningsEntry[];
  height?: number;
}

function formatMonthShort(month: string) {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

export function EarningsChart({ data, height = 200 }: EarningsChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatMonthShort(item.month),
        value: Math.round(item.earnings * 100) / 100,
        color: colors.success,
      })),
    [data]
  );

  return <SimpleBarChart data={bars} height={height} barColor={colors.success} maxLabels={12} />;
}

export default EarningsChart;
