import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { colors } from '@/theme';
import type { WeeklyTotal } from '@/hooks/useAnalytics';
import { SimpleBarChart } from './SimpleBarChart';

export interface WeeklyChartProps {
  data: WeeklyTotal[];
  height?: number;
  showTooltips?: boolean;
}

function secondsToHours(s: number) { return Math.round((s / 3600) * 10) / 10; }

function formatWeekShort(weekStart: string) {
  const date = new Date(weekStart + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatWeekLabel(weekStart: string) {
  const date = new Date(weekStart + 'T00:00:00');
  return `W/O ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function WeeklyChart({ data, height = 200 }: WeeklyChartProps): React.ReactElement {
  const bars = useMemo(
    () =>
      [...data].reverse().map((item) => ({
        label: formatWeekShort(item.weekStart),
        fullLabel: formatWeekLabel(item.weekStart),
        value: secondsToHours(item.totalSeconds),
        color: colors.secondary,
      })),
    [data]
  );

  if (Platform.OS === 'web') {
    return <SimpleBarChart data={bars} height={height} barColor={colors.secondary} maxLabels={6} />;
  }

  const {
    VictoryBar, VictoryChart, VictoryAxis, VictoryTheme, VictoryTooltip, VictoryVoronoiContainer,
  } = require('victory-native');

  const { width } = useWindowDimensions();
  const chartWidth = width - 48;
  const chartData = bars.map((b, i) => ({ x: i, y: b.value, label: `${b.fullLabel}\n${b.value}h` }));
  const maxY = Math.ceil(Math.max(...chartData.map((d) => d.y), 1) * 1.1);
  const step = chartData.length > 8 ? 2 : 1;
  const xTickValues = chartData.filter((_, i) => i % step === 0).map((d) => d.x);

  return (
    <View style={styles.container}>
      <VictoryChart
        width={chartWidth} height={height}
        theme={VictoryTheme.grayscale}
        domainPadding={{ x: 15 }}
        padding={{ top: 20, bottom: 40, left: 45, right: 20 }}
        containerComponent={
          <VictoryVoronoiContainer voronoiDimension="x"
            labels={({ datum }: { datum: { label: string } }) => datum.label}
            labelComponent={<VictoryTooltip cornerRadius={4}
              flyoutStyle={{ stroke: colors.border, fill: colors.surface }}
              style={{ fill: colors.text, fontSize: 11 }} />}
          />
        }
      >
        <VictoryAxis tickValues={xTickValues}
          tickFormat={(t: number) => { const d = chartData.find((c) => c.x === t); return d ? bars[d.x]?.label ?? '' : ''; }}
          style={{ tickLabels: { angle: -45, textAnchor: 'end', fontSize: 9, fill: colors.textMuted } }} />
        <VictoryAxis dependentAxis domain={[0, maxY]}
          tickFormat={(t: number) => `${t}h`}
          style={{ tickLabels: { fill: colors.textMuted, fontSize: 10 }, grid: { stroke: colors.border, strokeDasharray: '4,4' } }} />
        <VictoryBar data={chartData} barRatio={0.7} cornerRadius={{ top: 3 }}
          style={{ data: { fill: ({ datum }: { datum: { y: number } }) => datum.y > 0 ? colors.secondary : colors.surfaceVariant } }} />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({ container: { alignItems: 'center' } });
export default WeeklyChart;
