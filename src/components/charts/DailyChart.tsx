import React, { useMemo } from 'react';
import { colors } from '@/theme';
import type { DailyTotal } from '@/hooks/useAnalytics';
import { SimpleBarChart } from './SimpleBarChart';

export interface DailyChartProps {
  data: DailyTotal[];
  height?: number;
  showTooltips?: boolean;
  tickCount?: number;
}

function secondsToHours(s: number) {
  return Math.round((s / 3600) * 10) / 10;
}

function formatDateAbbreviated(d: string) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DailyChart({ data, height = 200 }: DailyChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatDateAbbreviated(item.date),
        value: secondsToHours(item.totalSeconds),
        color: colors.primary,
      })),
    [data]
  );

  return <SimpleBarChart data={bars} height={height} barColor={colors.primary} maxLabels={7} />;
}

export default DailyChart;
