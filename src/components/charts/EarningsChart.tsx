import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
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
  const { width } = useWindowDimensions();
  const bars = useMemo(
    () =>
      [...data].reverse().map(item => ({
        label: formatMonthShort(item.month),
        value: Math.round(item.earnings * 100) / 100,
        color: colors.success,
      })),
    [data]
  );

  if (Platform.OS === 'web') {
    return <SimpleBarChart data={bars} height={height} barColor={colors.success} maxLabels={12} />;
  }

  const {
    VictoryBar,
    VictoryChart,
    VictoryAxis,
    VictoryTheme,
    VictoryTooltip,
    VictoryVoronoiContainer,
  } = require('victory-native');
  const chartWidth = width - 48;
  const chartData = bars.map((b, i) => ({
    x: i,
    y: b.value,
    label: `${b.label}\n$${b.value.toFixed(2)}`,
  }));
  const maxY = Math.ceil(Math.max(...chartData.map(d => d.y), 1) * 1.1);
  const step = chartData.length > 8 ? 2 : 1;
  const xTickValues = chartData.filter((_, i) => i % step === 0).map(d => d.x);

  return (
    <View style={styles.container}>
      <VictoryChart
        width={chartWidth}
        height={height}
        theme={VictoryTheme.grayscale}
        domainPadding={{ x: 15 }}
        padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
        containerComponent={
          <VictoryVoronoiContainer
            voronoiDimension="x"
            labels={({ datum }: { datum: { label: string } }) => datum.label}
            labelComponent={
              <VictoryTooltip
                cornerRadius={4}
                flyoutStyle={{ stroke: colors.border, fill: colors.surface }}
                style={{ fill: colors.text, fontSize: 11 }}
              />
            }
          />
        }
      >
        <VictoryAxis
          tickValues={xTickValues}
          tickFormat={(t: number) => {
            const d = chartData.find(c => c.x === t);
            return d ? (bars[d.x]?.label ?? '') : '';
          }}
          style={{ tickLabels: { fontSize: 10, fill: colors.textMuted } }}
        />
        <VictoryAxis
          dependentAxis
          domain={[0, maxY]}
          tickFormat={(t: number) => `$${t}`}
          style={{
            tickLabels: { fill: colors.textMuted, fontSize: 10 },
            grid: { stroke: colors.border, strokeDasharray: '4,4' },
          }}
        />
        <VictoryBar
          data={chartData}
          barRatio={0.7}
          cornerRadius={{ top: 3 }}
          style={{
            data: {
              fill: ({ datum }: { datum: { y: number } }) =>
                datum.y > 0 ? colors.success : colors.surfaceVariant,
            },
          }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({ container: { alignItems: 'center' } });
export default EarningsChart;
