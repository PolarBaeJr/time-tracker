/**
 * HeatmapChart Component
 *
 * Heatmap grid showing hour-of-day (y-axis) vs day-of-week (x-axis)
 * with color intensity based on logged hours.
 *
 * USAGE:
 * ```typescript
 * import { HeatmapChart } from '@/components/charts';
 * import { useHourOfDayDistribution, useDayOfWeekDistribution } from '@/hooks/useAnalytics';
 *
 * function ActivityHeatmap() {
 *   const { data: hourData } = useHourOfDayDistribution({ days: 30 });
 *   const { data: dayData } = useDayOfWeekDistribution({ weeks: 4 });
 *
 *   return (
 *     <ChartContainer isEmpty={!hourData && !dayData}>
 *       <HeatmapChart hourData={hourData} dayData={dayData} />
 *     </ChartContainer>
 *   );
 * }
 * ```
 *
 * REQUIRES: victory-native, react-native-svg
 * Install: npx expo install victory-native react-native-svg
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';

import { colors } from '@/theme';
import { Text } from '@/components/ui';
import type { HourOfDayDistribution, DayOfWeekDistribution } from '@/hooks/useAnalytics';

// ============================================================================
// TYPES
// ============================================================================

export interface HeatmapChartProps {
  /** 24-element array of seconds per hour (index 0 = midnight) */
  hourData?: HourOfDayDistribution;
  /** 7-element array of seconds per day (index 0 = Sunday) */
  dayData?: DayOfWeekDistribution;
  /** Chart height (default: 280) */
  height?: number;
  /** Cell size (default: auto-calculated) */
  cellSize?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = [
  '12a',
  '1a',
  '2a',
  '3a',
  '4a',
  '5a',
  '6a',
  '7a',
  '8a',
  '9a',
  '10a',
  '11a',
  '12p',
  '1p',
  '2p',
  '3p',
  '4p',
  '5p',
  '6p',
  '7p',
  '8p',
  '9p',
  '10p',
  '11p',
];

// Show every 3rd hour label to avoid crowding
const VISIBLE_HOUR_INDICES = [0, 3, 6, 9, 12, 15, 18, 21];

// Color scale for heatmap (from empty to intense)
const HEAT_COLORS = [
  colors.surfaceVariant, // 0: No activity
  '#1e3a5f', // 1: Very low
  '#2563eb', // 2: Low
  '#3b82f6', // 3: Medium-low
  '#6366f1', // 4: Medium (primary)
  '#8b5cf6', // 5: Medium-high
  '#a855f7', // 6: High
  '#c026d3', // 7: Very high
  '#e879f9', // 8: Intense
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert seconds to hours
 */
function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

/**
 * Get color index based on intensity (0-8)
 */
function getColorIndex(value: number, maxValue: number): number {
  if (value === 0 || maxValue === 0) return 0;
  const ratio = value / maxValue;
  // Map ratio to 1-8 range (0 is reserved for no activity)
  return Math.min(8, Math.max(1, Math.ceil(ratio * 8)));
}

/**
 * Format hours for display
 */
function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Heatmap grid showing activity patterns
 *
 * Features:
 * - 7 columns (days of week) x 24 rows (hours of day)
 * - Color intensity based on tracked time
 * - Hour labels on y-axis
 * - Day labels on x-axis
 * - Dark theme styling
 */
export function HeatmapChart({
  hourData,
  dayData,
  height = 280,
}: HeatmapChartProps): React.ReactElement {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const chartWidth = containerWidth;

  // Layout calculations
  const leftPadding = 35; // Space for hour labels
  const topPadding = 25; // Space for day labels
  const bottomPadding = 10;
  const rightPadding = 10;

  const availableWidth = chartWidth - leftPadding - rightPadding;
  const availableHeight = height - topPadding - bottomPadding;

  const cellWidth = Math.floor(availableWidth / 7);
  const cellHeight = Math.floor(availableHeight / 24);
  const gap = 1; // Gap between cells

  // Create a simplified heatmap data structure
  // For now, we'll combine hourData and dayData into a visual representation
  const heatmapData = useMemo(() => {
    // If we have both hour and day data, create a combined visualization
    // Each cell[day][hour] = relative intensity

    if (!hourData && !dayData) {
      return null;
    }

    // Calculate the grid values
    // We'll use a simple model where cell intensity = hourFactor * dayFactor
    const grid: number[][] = [];

    // Normalize hour data
    const hourMax = hourData ? Math.max(...hourData, 1) : 1;
    const normalizedHours = hourData ? hourData.map(h => h / hourMax) : new Array(24).fill(0.5);

    // Normalize day data
    const dayMax = dayData ? Math.max(...dayData, 1) : 1;
    const normalizedDays = dayData ? dayData.map(d => d / dayMax) : new Array(7).fill(0.5);

    // Build grid: day (x) x hour (y)
    for (let hour = 0; hour < 24; hour++) {
      const row: number[] = [];
      for (let day = 0; day < 7; day++) {
        // Combine hour and day factors
        const hourFactor = normalizedHours[hour];
        const dayFactor = normalizedDays[day];
        // Use geometric mean for combined intensity
        const combined = Math.sqrt(hourFactor * dayFactor);
        row.push(combined);
      }
      grid.push(row);
    }

    return grid;
  }, [hourData, dayData]);

  // Calculate max for color scaling
  const maxValue = useMemo(() => {
    if (!heatmapData) return 0;
    return Math.max(...heatmapData.flat(), 0.01);
  }, [heatmapData]);

  // Generate legend items
  const legendItems = useMemo(() => {
    return [
      { color: HEAT_COLORS[0], label: 'None' },
      { color: HEAT_COLORS[2], label: 'Low' },
      { color: HEAT_COLORS[5], label: 'Med' },
      { color: HEAT_COLORS[8], label: 'High' },
    ];
  }, []);

  if (!heatmapData) {
    return <View style={[styles.container, { height }]} onLayout={onLayout} />;
  }

  if (chartWidth === 0) {
    return <View style={[styles.container, { height }]} onLayout={onLayout} />;
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={chartWidth} height={height}>
        {/* Day labels (x-axis, top) */}
        <G>
          {DAY_LABELS.map((day, index) => (
            <SvgText
              key={`day-${index}`}
              x={leftPadding + index * cellWidth + cellWidth / 2}
              y={15}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {day}
            </SvgText>
          ))}
        </G>

        {/* Hour labels (y-axis, left) */}
        <G>
          {VISIBLE_HOUR_INDICES.map(hourIndex => (
            <SvgText
              key={`hour-${hourIndex}`}
              x={leftPadding - 5}
              y={topPadding + hourIndex * cellHeight + cellHeight / 2 + 3}
              fontSize={8}
              fill={colors.textMuted}
              textAnchor="end"
            >
              {HOUR_LABELS[hourIndex]}
            </SvgText>
          ))}
        </G>

        {/* Heatmap cells */}
        <G>
          {heatmapData.map((row, hourIndex) =>
            row.map((value, dayIndex) => {
              const colorIndex = getColorIndex(value, maxValue);
              return (
                <Rect
                  key={`cell-${hourIndex}-${dayIndex}`}
                  x={leftPadding + dayIndex * cellWidth + gap}
                  y={topPadding + hourIndex * cellHeight + gap}
                  width={cellWidth - gap * 2}
                  height={cellHeight - gap * 2}
                  rx={2}
                  fill={HEAT_COLORS[colorIndex]}
                />
              );
            })
          )}
        </G>
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {legendItems.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <Text variant="caption" color="muted">
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Summary stats */}
      {(hourData || dayData) && (
        <View style={styles.stats}>
          {hourData && (
            <View style={styles.statItem}>
              <Text variant="caption" color="muted">
                Peak hour:{' '}
                <Text variant="caption" color="primary">
                  {HOUR_LABELS[hourData.indexOf(Math.max(...hourData))]}
                </Text>
              </Text>
            </View>
          )}
          {dayData && (
            <View style={styles.statItem}>
              <Text variant="caption" color="muted">
                Most active:{' '}
                <Text variant="caption" color="primary">
                  {DAY_LABELS[dayData.indexOf(Math.max(...dayData))]}
                </Text>
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
  },
});

export default HeatmapChart;
