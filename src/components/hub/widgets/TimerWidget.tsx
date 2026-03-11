/**
 * TimerWidget Component
 *
 * Hub widget displaying today's tracked time, active timer status,
 * and quick navigation to the Timer tab.
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { WidgetCard } from '../WidgetCard';
import { Text, Button, Icon } from '@/components/ui';
import { useTheme, spacing } from '@/theme';
import { useDailyTotals } from '@/hooks/useAnalytics';
import { useTimerStore } from '@/stores';
import type { WidgetSize } from '../WidgetRegistry';
import type { MainTabParamList } from '@/navigation/types';

/**
 * TimerWidget component props
 */
export interface TimerWidgetProps {
  /** Widget size affects layout and information density */
  size: WidgetSize;
}

type TabNav = BottomTabNavigationProp<MainTabParamList>;

/**
 * Format seconds to human-readable duration (Xh Xm)
 */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0 && minutes === 0) {
    return '0m';
  }

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Status dot indicator for active timer
 * Shows a solid green dot when timer is running
 */
function StatusDot({ color }: { color: string }): React.ReactElement {
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

/**
 * TimerWidget Component
 *
 * Displays today's tracked time with active timer indicator.
 * - Small size: Compact view with time only
 * - Medium/Large: Full view with progress and start button
 */
export function TimerWidget({ size }: TimerWidgetProps): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<TabNav>();

  // Fetch today's total time
  const { data: dailyTotals, isLoading, error } = useDailyTotals({ days: 1 });

  // Get active timer state
  const localElapsed = useTimerStore(state => state.localElapsed);
  const isRunning = useTimerStore(state => state.isRunning);

  // Calculate today's total including active timer
  const todayTotal = React.useMemo(() => {
    const completedTime = dailyTotals?.[0]?.totalSeconds ?? 0;
    // Add current timer elapsed if running
    const activeTime = isRunning ? localElapsed : 0;
    return completedTime + activeTime;
  }, [dailyTotals, isRunning, localElapsed]);

  const handleNavigateToTimer = React.useCallback(() => {
    navigation.navigate('Timer');
  }, [navigation]);

  // Render compact view for small size
  if (size === 'small') {
    return (
      <WidgetCard
        title="Timer"
        icon="time"
        size={size}
        loading={isLoading}
        error={error ?? null}
        onExpand={handleNavigateToTimer}
      >
        <Pressable
          onPress={handleNavigateToTimer}
          style={styles.compactContainer}
          accessibilityRole="button"
          accessibilityLabel={`Today's time: ${formatDuration(todayTotal)}${isRunning ? ', timer running' : ''}`}
        >
          <View style={styles.compactRow}>
            {isRunning && <StatusDot color={colors.success} />}
            <Text variant="heading" style={styles.compactTime}>
              {formatDuration(todayTotal)}
            </Text>
          </View>
        </Pressable>
      </WidgetCard>
    );
  }

  // Render full view for medium/large size
  return (
    <WidgetCard
      title="Timer"
      icon="time"
      size={size}
      loading={isLoading}
      error={error ?? null}
      onExpand={handleNavigateToTimer}
    >
      <View style={styles.fullContainer}>
        {/* Today's Total */}
        <View style={styles.timeSection}>
          <Text variant="caption" color="secondary">
            Today
          </Text>
          <Text variant="display" style={styles.timeValue}>
            {formatDuration(todayTotal)}
          </Text>
        </View>

        {/* Active Timer Indicator */}
        {isRunning && (
          <View style={[styles.activeIndicator, { backgroundColor: `${colors.success}15` }]}>
            <StatusDot color={colors.success} />
            <View style={styles.activeTextContainer}>
              <Text variant="bodySmall" style={{ color: colors.success }}>
                Running
              </Text>
            </View>
            <Text variant="bodySmall" style={{ color: colors.success }}>
              {formatDuration(localElapsed)}
            </Text>
          </View>
        )}

        {/* Start Timer Button */}
        {!isRunning && (
          <Button
            variant="primary"
            size={size === 'large' ? 'md' : 'sm'}
            onPress={handleNavigateToTimer}
            style={styles.startButton}
          >
            <View style={styles.buttonContent}>
              <Icon name="play" size={16} color={colors.text} />
              <Text variant="label" style={styles.buttonText}>
                Start Timer
              </Text>
            </View>
          </Button>
        )}
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactTime: {
    marginLeft: spacing.xs,
  },
  fullContainer: {
    minHeight: 80,
  },
  timeSection: {
    marginBottom: spacing.sm,
  },
  timeValue: {
    marginTop: spacing.xs,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  activeTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  startButton: {
    marginTop: spacing.xs,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    marginLeft: spacing.xs,
  },
});

export default TimerWidget;
