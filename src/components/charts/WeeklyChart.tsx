import React, { useMemo } from 'react';
import { colors } from '@/theme';
import type { WeeklyTotal } from '@/hooks/useAnalytics';
import { SimpleBarChart } from './SimpleBarChart';

export interface WeeklyChartProps {
  data: WeeklyTotal[];
  height?: number;
  showTooltips?: boolean;
}

function secondsToHours(s: number) {
  return Math.round((s / 3600) * 10) / 10;
}

function formatWeekShort(weekStart: string) {
  const date = new Date(weekStart + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function WeeklyChart({ data, height = 200 }: WeeklyChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatWeekShort(item.weekStart),
        value: secondsToHours(item.totalSeconds),
        color: colors.secondary,
      })),
    [data]
  );

  return <SimpleBarChart data={bars} height={height} barColor={colors.secondary} maxLabels={6} />;
}

export default WeeklyChart;
