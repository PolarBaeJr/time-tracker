import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Switch, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useUXSettings, setSoundEnabled, setSoundVolume, setSoundPreset } from '@/stores';
import { useSounds } from '@/hooks/useTimerSounds';
import { SOUND_PRESET_NAMES, SOUND_PRESET_DESCRIPTIONS } from '@/lib/sounds';
import { colors, spacing, borderRadius, fontSizes } from '@/theme';
import type { SoundPreset } from '@/schemas/uxSettings';

export interface TimerSoundSettingsProps {
  disabled?: boolean;
}

const SOUND_PRESETS: SoundPreset[] = ['classic', 'soft', 'minimal'];

export function TimerSoundSettings({
  disabled = false,
}: TimerSoundSettingsProps): React.ReactElement {
  const { soundEnabled, soundVolume, soundPreset } = useUXSettings();
  const { playSound } = useSounds();

  const volumePercent = Math.round(soundVolume * 100);

  const handleToggle = useCallback((value: boolean) => {
    setSoundEnabled(value);
  }, []);

  const handleVolumeIncrement = useCallback(() => {
    const newVolume = Math.min(1, soundVolume + 0.1);
    setSoundVolume(Math.round(newVolume * 10) / 10);
  }, [soundVolume]);

  const handleVolumeDecrement = useCallback(() => {
    const newVolume = Math.max(0, soundVolume - 0.1);
    setSoundVolume(Math.round(newVolume * 10) / 10);
  }, [soundVolume]);

  const handlePresetChange = useCallback((preset: SoundPreset) => {
    setSoundPreset(preset);
  }, []);

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
          {/* Volume Control */}
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

          {/* Sound Preset Selection */}
          <View style={styles.presetSection}>
            <Text style={styles.presetSectionLabel}>Sound Style</Text>
            <View style={styles.presetOptions}>
              {SOUND_PRESETS.map(preset => (
                <Pressable
                  key={preset}
                  style={[styles.presetOption, soundPreset === preset && styles.presetOptionActive]}
                  onPress={() => handlePresetChange(preset)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: soundPreset === preset }}
                  accessibilityLabel={`${SOUND_PRESET_NAMES[preset]}: ${SOUND_PRESET_DESCRIPTIONS[preset]}`}
                >
                  <Text
                    style={[
                      styles.presetOptionText,
                      soundPreset === preset && styles.presetOptionTextActive,
                    ]}
                  >
                    {SOUND_PRESET_NAMES[preset]}
                  </Text>
                  <Text
                    style={[
                      styles.presetOptionDescription,
                      soundPreset === preset && styles.presetOptionDescriptionActive,
                    ]}
                  >
                    {SOUND_PRESET_DESCRIPTIONS[preset]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Test Sound Button */}
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
  presetSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  presetSectionLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  presetOptions: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  presetOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  presetOptionText: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: '600',
  },
  presetOptionTextActive: {
    color: colors.primary,
  },
  presetOptionDescription: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  presetOptionDescriptionActive: {
    color: colors.primary + 'CC',
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
