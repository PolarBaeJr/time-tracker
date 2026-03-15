/**
 * SimpleBarChart — cross-platform bar chart built with View components.
 * Works on web and native without any native modules.
 *
 * Features:
 * - Bar grow animation on mount (height from 0 to final)
 * - Stagger animation for multiple bars (50ms delay per bar)
 * - Respects reduced motion settings
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { ANIMATION_DURATION, ANIMATION_EASING } from '@/lib/animations';

export interface BarDatum {
  label: string;
  value: number; // hours (already converted)
  color?: string;
}

export interface SimpleBarChartProps {
  data: BarDatum[];
  height?: number;
  barColor?: string;
  /** How many x-axis labels to show (evenly spaced) */
  maxLabels?: number;
  /** Enable bar grow animation on mount (default: true) */
  animateOnMount?: boolean;
  /** Stagger delay between bars in ms (default: 50) */
  staggerDelay?: number;
  /** Animation duration per bar in ms (default: 300) */
  animationDuration?: number;
}

function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Animated bar component that grows from bottom to top
 */
interface AnimatedBarProps {
  heightPct: number;
  color: string;
  index: number;
  shouldAnimate: boolean;
  staggerDelay: number;
  animationDuration: number;
}

function AnimatedBar({
  heightPct,
  color,
  index,
  shouldAnimate,
  staggerDelay,
  animationDuration,
}: AnimatedBarProps): React.ReactElement {
  // Use useState with lazy initializer for React Compiler compatibility
  const [heightAnim] = useState(() => new Animated.Value(shouldAnimate ? 0 : heightPct));
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (shouldAnimate && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      const delay = index * staggerDelay;

      Animated.timing(heightAnim, {
        toValue: heightPct,
        duration: animationDuration,
        delay,
        easing: ANIMATION_EASING.easeOut,
        useNativeDriver: false, // height animation requires JS driver
      }).start();
    } else if (!shouldAnimate) {
      // If animations disabled, set immediately
      heightAnim.setValue(heightPct);
    }
  }, [shouldAnimate, heightPct, index, staggerDelay, animationDuration, heightAnim]);

  // Update height when data changes (for re-renders with new data)
  useEffect(() => {
    if (hasAnimatedRef.current && shouldAnimate) {
      // Animate to new height if already animated once
      Animated.timing(heightAnim, {
        toValue: heightPct,
        duration: animationDuration / 2, // Faster for updates
        easing: ANIMATION_EASING.easeOut,
        useNativeDriver: false,
      }).start();
    }
  }, [heightPct, shouldAnimate, animationDuration, heightAnim]);

  const animatedHeightStyle = shouldAnimate
    ? {
        height: heightAnim.interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', '100%'],
          extrapolate: 'clamp',
        }),
      }
    : {
        height: `${Math.max(heightPct, heightPct > 0 ? 2 : 0)}%` as unknown as number,
      };

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          ...animatedHeightStyle,
          backgroundColor: color,
        },
      ]}
    />
  );
}

export function SimpleBarChart({
  data,
  height = 200,
  barColor = colors.primary,
  maxLabels = 7,
  animateOnMount = true,
  staggerDelay = 50,
  animationDuration = 300,
}: SimpleBarChartProps): React.ReactElement {
  // Get animation preferences from UX settings
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animateOnMount && animationsEnabled && !reducedMotion;

  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 0.1), [data]);

  // Pick which indices get an x-axis label
  const labelStep = useMemo(
    () => Math.max(1, Math.ceil(data.length / maxLabels)),
    [data.length, maxLabels]
  );

  if (data.length === 0) {
    return <View style={{ height }} />;
  }

  const chartHeight = height - 32; // leave room for x-axis labels
  const yAxisWidth = 36;

  // Y-axis ticks: 0, half, max
  const topLabel = formatHours(maxValue);
  const midLabel = formatHours(maxValue / 2);

  return (
    <View style={styles.container}>
      {/* Chart area */}
      <View style={{ flexDirection: 'row', height: chartHeight }}>
        {/* Y-axis */}
        <View style={[styles.yAxis, { width: yAxisWidth }]}>
          <Text variant="caption" color="muted" style={styles.yLabel}>
            {topLabel}
          </Text>
          <Text variant="caption" color="muted" style={styles.yLabel}>
            {midLabel}
          </Text>
          <Text variant="caption" color="muted" style={styles.yLabel}>
            0h
          </Text>
        </View>

        {/* Bars */}
        <View style={styles.barsArea}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: '50%' }]} />
          <View style={[styles.gridLine, { top: '100%' }]} />

          {/* Bar columns */}
          <View style={styles.barsRow}>
            {data.map((d, i) => {
              const heightPct = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
              const color = d.value > 0 ? (d.color ?? barColor) : colors.surfaceVariant;
              return (
                <View key={i} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <AnimatedBar
                      heightPct={Math.max(heightPct, d.value > 0 ? 2 : 0)}
                      color={color}
                      index={i}
                      shouldAnimate={shouldAnimate}
                      staggerDelay={staggerDelay}
                      animationDuration={animationDuration}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis labels */}
      <View style={[styles.xAxis, { marginLeft: yAxisWidth }]}>
        {data.map((d, i) => (
          <View key={i} style={styles.xLabelContainer}>
            {i % labelStep === 0 ? (
              <Text variant="caption" color="muted" style={styles.xLabel} numberOfLines={1}>
                {d.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
  yAxis: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
    paddingBottom: 2,
  },
  yLabel: {
    fontSize: 10,
  },
  barsArea: {
    position: 'relative',
    flex: 1,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  barTrack: {
    width: '80%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
    minHeight: 0,
  },
  xAxis: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  xLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  xLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
});

export default SimpleBarChart;
