import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Switch, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useTimerSettings, updateTimerSettings } from '@/stores';
import { colors, spacing, borderRadius, fontSizes } from '@/theme';

const THRESHOLD_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

export interface IdleDetectionSettingsProps {
  disabled?: boolean;
}

export function IdleDetectionSettings({
  disabled = false,
}: IdleDetectionSettingsProps): React.ReactElement {
  const { idleDetectionEnabled, idleThresholdMinutes } = useTimerSettings();

  const currentIndex = THRESHOLD_OPTIONS.indexOf(
    idleThresholdMinutes as (typeof THRESHOLD_OPTIONS)[number]
  );
  const safeIndex = currentIndex === -1 ? 2 : currentIndex; // default to 15 min

  const handleToggle = useCallback((value: boolean) => {
    updateTimerSettings({ idleDetectionEnabled: value });
  }, []);

  const handleIncrement = useCallback(() => {
    const nextIndex = Math.min(safeIndex + 1, THRESHOLD_OPTIONS.length - 1);
    updateTimerSettings({ idleThresholdMinutes: THRESHOLD_OPTIONS[nextIndex] });
  }, [safeIndex]);

  const handleDecrement = useCallback(() => {
    const nextIndex = Math.max(safeIndex - 1, 0);
    updateTimerSettings({ idleThresholdMinutes: THRESHOLD_OPTIONS[nextIndex] });
  }, [safeIndex]);

  const isAtMin = safeIndex <= 0;
  const isAtMax = safeIndex >= THRESHOLD_OPTIONS.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enable Idle Detection</Text>
        <Switch
          value={idleDetectionEnabled}
          onValueChange={handleToggle}
          disabled={disabled}
          trackColor={{ false: colors.surfaceVariant, true: colors.primary + '80' }}
          thumbColor={idleDetectionEnabled ? colors.primary : colors.textMuted}
        />
      </View>

      {idleDetectionEnabled && (
        <View style={styles.settingsGroup}>
          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Idle Threshold</Text>
            <View style={styles.stepperControls}>
              <Pressable
                style={[styles.stepperButton, isAtMin && styles.stepperButtonDisabled]}
                onPress={handleDecrement}
                disabled={isAtMin}
                accessibilityRole="button"
                accessibilityLabel="Decrease idle threshold"
              >
                <Text
                  style={
                    StyleSheet.flatten([
                      styles.stepperButtonText,
                      isAtMin && styles.stepperButtonTextDisabled,
                    ]) as TextStyle
                  }
                >
                  -
                </Text>
              </Pressable>
              <Text style={styles.stepperValue}>{idleThresholdMinutes} min</Text>
              <Pressable
                style={[styles.stepperButton, isAtMax && styles.stepperButtonDisabled]}
                onPress={handleIncrement}
                disabled={isAtMax}
                accessibilityRole="button"
                accessibilityLabel="Increase idle threshold"
              >
                <Text
                  style={
                    StyleSheet.flatten([
                      styles.stepperButtonText,
                      isAtMax && styles.stepperButtonTextDisabled,
                    ]) as TextStyle
                  }
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '500',
  },
  settingsGroup: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepperLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonText: {
    fontSize: fontSizes.lg,
    color: colors.text,
    fontWeight: '600',
    lineHeight: fontSizes.lg * 1.2,
  },
  stepperButtonTextDisabled: {
    color: colors.textMuted,
  },
  stepperValue: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
});

export default IdleDetectionSettings;
