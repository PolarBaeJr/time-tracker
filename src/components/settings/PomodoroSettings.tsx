import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Switch, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { usePomodoroSettings } from '@/hooks';
import { colors, spacing, borderRadius, fontSizes } from '@/theme';

export interface PomodoroSettingsProps {
  disabled?: boolean;
}

interface StepperRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
  unit?: string;
}

function StepperRow({
  label,
  value,
  min,
  max,
  onIncrement,
  onDecrement,
  unit = 'min',
}: StepperRowProps): React.ReactElement {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
          onPress={onDecrement}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text
            style={
              StyleSheet.flatten([
                styles.stepperButtonText,
                value <= min && styles.stepperButtonTextDisabled,
              ]) as TextStyle
            }
          >
            -
          </Text>
        </Pressable>
        <Text style={styles.stepperValue}>
          {value} {unit}
        </Text>
        <Pressable
          style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
          onPress={onIncrement}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text
            style={
              StyleSheet.flatten([
                styles.stepperButtonText,
                value >= max && styles.stepperButtonTextDisabled,
              ]) as TextStyle
            }
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PomodoroSettings({ disabled = false }: PomodoroSettingsProps): React.ReactElement {
  const { settings, updateSettings } = usePomodoroSettings();

  const handleToggle = useCallback(
    (value: boolean) => {
      updateSettings({ pomodoroEnabled: value });
    },
    [updateSettings]
  );

  const workMinutes = Math.round(settings.workDurationSeconds / 60);
  const breakMinutes = Math.round(settings.breakDurationSeconds / 60);
  const longBreakMinutes = Math.round(settings.longBreakDurationSeconds / 60);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enable Pomodoro Mode</Text>
        <Switch
          value={settings.pomodoroEnabled}
          onValueChange={handleToggle}
          disabled={disabled}
          trackColor={{ false: colors.surfaceVariant, true: colors.primary + '80' }}
          thumbColor={settings.pomodoroEnabled ? colors.primary : colors.textMuted}
        />
      </View>

      {settings.pomodoroEnabled && (
        <View style={styles.settingsGroup}>
          <StepperRow
            label="Work Duration"
            value={workMinutes}
            min={1}
            max={120}
            onIncrement={() => updateSettings({ workDurationSeconds: (workMinutes + 1) * 60 })}
            onDecrement={() => updateSettings({ workDurationSeconds: (workMinutes - 1) * 60 })}
          />
          <StepperRow
            label="Short Break"
            value={breakMinutes}
            min={1}
            max={60}
            onIncrement={() => updateSettings({ breakDurationSeconds: (breakMinutes + 1) * 60 })}
            onDecrement={() => updateSettings({ breakDurationSeconds: (breakMinutes - 1) * 60 })}
          />
          <StepperRow
            label="Long Break"
            value={longBreakMinutes}
            min={1}
            max={60}
            onIncrement={() =>
              updateSettings({ longBreakDurationSeconds: (longBreakMinutes + 1) * 60 })
            }
            onDecrement={() =>
              updateSettings({ longBreakDurationSeconds: (longBreakMinutes - 1) * 60 })
            }
          />
          <View style={styles.toggleRow}>
            <Text style={styles.stepperLabel}>Auto-start after break</Text>
            <Switch
              value={settings.autoStartAfterBreak}
              onValueChange={(value: boolean) => updateSettings({ autoStartAfterBreak: value })}
              disabled={disabled}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary + '80' }}
              thumbColor={settings.autoStartAfterBreak ? colors.primary : colors.textMuted}
            />
          </View>
          <StepperRow
            label="Cycles Before Long Break"
            value={settings.pomodorosBeforeLongBreak}
            min={1}
            max={10}
            unit=""
            onIncrement={() =>
              updateSettings({ pomodorosBeforeLongBreak: settings.pomodorosBeforeLongBreak + 1 })
            }
            onDecrement={() =>
              updateSettings({ pomodorosBeforeLongBreak: settings.pomodorosBeforeLongBreak - 1 })
            }
          />
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

export default PomodoroSettings;
