/**
 * WeekStartSelector component
 *
 * Picker for week start day (Sunday=0 through Saturday=6).
 * Labeled with day names for clarity.
 */

import * as React from 'react';
import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '@/theme';

/**
 * Day names indexed by week start day value (0-6)
 */
const DAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/**
 * Short day names for compact display
 */
const SHORT_DAY_NAMES: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export interface WeekStartSelectorProps {
  /** Currently selected week start day (0=Sunday through 6=Saturday) */
  value: number;
  /** Callback when week start day is selected */
  onChange: (day: number) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Additional styles */
  style?: ViewStyle;
}

/**
 * WeekStartSelector component
 *
 * @example
 * ```tsx
 * <WeekStartSelector
 *   value={settings.week_start_day}
 *   onChange={handleWeekStartChange}
 * />
 * ```
 */
export function WeekStartSelector({
  value,
  onChange,
  disabled = false,
  loading = false,
  style,
}: WeekStartSelectorProps): React.ReactElement {
  const handleDayPress = useCallback(
    (day: number) => {
      if (!disabled && !loading) {
        onChange(day);
      }
    },
    [disabled, loading, onChange]
  );

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Week starts on</Text>
      <Text style={styles.helperText}>
        Choose which day your week begins
      </Text>

      <View style={styles.daysContainer}>
        {Object.entries(SHORT_DAY_NAMES).map(([dayValue, shortName]) => {
          const day = parseInt(dayValue, 10);
          const isSelected = day === value;
          const fullName = DAY_NAMES[day];

          return (
            <Pressable
              key={day}
              onPress={() => handleDayPress(day)}
              disabled={disabled || loading}
              style={[
                styles.dayButton,
                isSelected && styles.dayButtonSelected,
                (disabled || loading) && styles.dayButtonDisabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{
                selected: isSelected,
                disabled: disabled || loading,
              }}
              accessibilityLabel={`${fullName}${isSelected ? ', selected' : ''}`}
            >
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  (disabled || loading) && styles.dayTextDisabled,
                ]}
              >
                {shortName}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.currentSelection}>
        Currently: <Text style={styles.currentSelectionValue}>{DAY_NAMES[value]}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayButtonDisabled: {
    opacity: 0.5,
  },
  dayText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.text,
    fontWeight: fontWeights.bold,
  },
  dayTextDisabled: {
    color: colors.textMuted,
  },
  currentSelection: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  currentSelectionValue: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
});

export default WeekStartSelector;
