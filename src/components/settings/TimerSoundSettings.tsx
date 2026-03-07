import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Switch, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useTimerSettings, updateTimerSettings } from '@/stores';
import { useTimerSounds } from '@/hooks/useTimerSounds';
import { colors, spacing, borderRadius, fontSizes } from '@/theme';

export interface TimerSoundSettingsProps {
  disabled?: boolean;
}

export function TimerSoundSettings({
  disabled = false,
}: TimerSoundSettingsProps): React.ReactElement {
  const { soundEnabled, soundVolume } = useTimerSettings();
  const { playSound } = useTimerSounds();

  const volumePercent = Math.round(soundVolume * 100);

  const handleToggle = useCallback((value: boolean) => {
    updateTimerSettings({ soundEnabled: value });
  }, []);

  const handleVolumeIncrement = useCallback(() => {
    const newVolume = Math.min(1, soundVolume + 0.1);
    updateTimerSettings({ soundVolume: Math.round(newVolume * 10) / 10 });
  }, [soundVolume]);

  const handleVolumeDecrement = useCallback(() => {
    const newVolume = Math.max(0, soundVolume - 0.1);
    updateTimerSettings({ soundVolume: Math.round(newVolume * 10) / 10 });
  }, [soundVolume]);

  const handleTest = useCallback(() => {
    playSound('start');
  }, [playSound]);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enable Sounds</Text>
        <Switch
          value={soundEnabled}
          onValueChange={handleToggle}
          disabled={disabled}
          trackColor={{ false: colors.surfaceVariant, true: colors.primary + '80' }}
          thumbColor={soundEnabled ? colors.primary : colors.textMuted}
        />
      </View>

      {soundEnabled && (
        <View style={styles.settingsGroup}>
          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Volume</Text>
            <View style={styles.stepperControls}>
              <Pressable
                style={[styles.stepperButton, volumePercent <= 0 && styles.stepperButtonDisabled]}
                onPress={handleVolumeDecrement}
                disabled={volumePercent <= 0}
                accessibilityRole="button"
                accessibilityLabel="Decrease volume"
              >
                <Text
                  style={
                    StyleSheet.flatten([
                      styles.stepperButtonText,
                      volumePercent <= 0 && styles.stepperButtonTextDisabled,
                    ]) as TextStyle
                  }
                >
                  -
                </Text>
              </Pressable>
              <Text style={styles.stepperValue}>{volumePercent}%</Text>
              <Pressable
                style={[styles.stepperButton, volumePercent >= 100 && styles.stepperButtonDisabled]}
                onPress={handleVolumeIncrement}
                disabled={volumePercent >= 100}
                accessibilityRole="button"
                accessibilityLabel="Increase volume"
              >
                <Text
                  style={
                    StyleSheet.flatten([
                      styles.stepperButtonText,
                      volumePercent >= 100 && styles.stepperButtonTextDisabled,
                    ]) as TextStyle
                  }
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.testRow}>
            <Pressable style={styles.testButton} onPress={handleTest} accessibilityRole="button">
              <Text style={styles.testButtonText}>Test Sound</Text>
            </Pressable>
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
  testRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  testButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
  },
  testButtonText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
});

export default TimerSoundSettings;
