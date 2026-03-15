/**
 * LeaderboardFilters Component
 *
 * Compact filter controls for leaderboard period and metric selection.
 * Provides toggle buttons for:
 * - Period: This Week / This Month
 * - Metric: All Hours / Billable Only
 *
 * USAGE:
 * ```tsx
 * import { LeaderboardFilters } from '@/components/leaderboard';
 *
 * <LeaderboardFilters
 *   period="week"
 *   metric="total"
 *   onPeriodChange={(period) => setPeriod(period)}
 *   onMetricChange={(metric) => setMetric(metric)}
 * />
 * ```
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import {
  type LeaderboardPeriod,
  type LeaderboardMetric,
  PERIOD_NAMES,
  METRIC_NAMES,
} from '@/schemas';

/**
 * LeaderboardFilters component props
 */
export interface LeaderboardFiltersProps {
  /** Currently selected period */
  period: LeaderboardPeriod;
  /** Currently selected metric */
  metric: LeaderboardMetric;
  /** Callback when period changes */
  onPeriodChange: (period: LeaderboardPeriod) => void;
  /** Callback when metric changes */
  onMetricChange: (metric: LeaderboardMetric) => void;
  /** Whether filters are disabled */
  disabled?: boolean;
  /** Compact mode reduces spacing */
  compact?: boolean;
}

/**
 * Toggle button component for filter options
 */
interface ToggleButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  position: 'left' | 'right';
}

function ToggleButton({
  label,
  selected,
  onPress,
  disabled = false,
  position,
}: ToggleButtonProps): React.ReactElement {
  const { colors } = useTheme();

  const buttonStyle = [
    styles.toggleButton,
    position === 'left' ? styles.toggleButtonLeft : styles.toggleButtonRight,
    {
      backgroundColor: selected ? colors.primary : 'transparent',
      borderColor: selected ? colors.primary : colors.border,
    },
  ];

  return (
    <Pressable
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
    >
      <Text
        variant="caption"
        style={[
          styles.toggleText,
          { color: selected ? colors.text : colors.textSecondary },
          disabled && { opacity: 0.5 },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * LeaderboardFilters Component
 *
 * Renders two sets of toggle buttons for period and metric selection.
 * Uses a compact design suitable for embedding in headers or widgets.
 */
export function LeaderboardFilters({
  period,
  metric,
  onPeriodChange,
  onMetricChange,
  disabled = false,
  compact = false,
}: LeaderboardFiltersProps): React.ReactElement {
  const { colors } = useTheme();

  const handlePeriodToggle = React.useCallback(
    (newPeriod: LeaderboardPeriod) => {
      if (newPeriod !== period) {
        onPeriodChange(newPeriod);
      }
    },
    [period, onPeriodChange]
  );

  const handleMetricToggle = React.useCallback(
    (newMetric: LeaderboardMetric) => {
      if (newMetric !== metric) {
        onMetricChange(newMetric);
      }
    },
    [metric, onMetricChange]
  );

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Period Toggle */}
      <View style={styles.filterGroup}>
        <View style={[styles.toggleGroup, { borderColor: colors.border }]}>
          <ToggleButton
            label={PERIOD_NAMES.week}
            selected={period === 'week'}
            onPress={() => handlePeriodToggle('week')}
            disabled={disabled}
            position="left"
          />
          <ToggleButton
            label={PERIOD_NAMES.month}
            selected={period === 'month'}
            onPress={() => handlePeriodToggle('month')}
            disabled={disabled}
            position="right"
          />
        </View>
      </View>

      {/* Metric Toggle */}
      <View style={styles.filterGroup}>
        <View style={[styles.toggleGroup, { borderColor: colors.border }]}>
          <ToggleButton
            label={METRIC_NAMES.total}
            selected={metric === 'total'}
            onPress={() => handleMetricToggle('total')}
            disabled={disabled}
            position="left"
          />
          <ToggleButton
            label={METRIC_NAMES.billable}
            selected={metric === 'billable'}
            onPress={() => handleMetricToggle('billable')}
            disabled={disabled}
            position="right"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  containerCompact: {
    gap: spacing.sm,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  toggleButtonLeft: {
    borderTopLeftRadius: borderRadius.md - 1,
    borderBottomLeftRadius: borderRadius.md - 1,
    borderRightWidth: 0,
  },
  toggleButtonRight: {
    borderTopRightRadius: borderRadius.md - 1,
    borderBottomRightRadius: borderRadius.md - 1,
    borderLeftWidth: 0,
  },
  toggleText: {
    fontWeight: '500',
  },
});

export default LeaderboardFilters;
