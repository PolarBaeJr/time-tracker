/**
 * UXSettings component
 *
 * Displays user experience settings including:
 * - Animations toggle
 * - Haptic feedback toggle (mobile only)
 * - Sound settings (enabled, volume, preset selection)
 * - Reduced motion indicator (shows if system preference detected)
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Switch, Platform, Pressable, type TextStyle } from 'react-native';

import { Text, Icon } from '@/components/ui';
import {
  useUXSettings,
  setAnimationsEnabled,
  setHapticFeedbackEnabled,
  setSoundEnabled,
  setSoundVolume,
  setSoundPreset,
} from '@/stores';
import { useSounds } from '@/hooks/useTimerSounds';
import { SOUND_PRESET_NAMES, SOUND_PRESET_DESCRIPTIONS } from '@/lib/sounds';
import { useTheme } from '@/theme';
import { spacing, fontSizes, borderRadius } from '@/theme';
import type { SoundPreset } from '@/schemas/uxSettings';

export interface UXSettingsProps {
  disabled?: boolean;
  /** Whether to show sound settings (default: true) */
  showSoundSettings?: boolean;
}

const SOUND_PRESETS: SoundPreset[] = ['classic', 'soft', 'minimal'];

/**
 * UXSettings displays toggles for animations, haptic feedback, and sound settings,
 * along with a reduced motion status indicator.
 *
 * @example
 * ```tsx
 * <UXSettings disabled={isUpdating} />
 * ```
 */
export function UXSettings({
  disabled = false,
  showSoundSettings = true,
}: UXSettingsProps): React.ReactElement {
  const { colors: themeColors } = useTheme();
  const {
    animationsEnabled,
    hapticFeedbackEnabled,
    reducedMotion,
    soundEnabled,
    soundVolume,
    soundPreset,
  } = useUXSettings();
  const { playSound } = useSounds();

  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';
  const volumePercent = Math.round(soundVolume * 100);

  const handleAnimationsToggle = useCallback(
    (value: boolean) => {
      if (!disabled) {
        setAnimationsEnabled(value);
      }
    },
    [disabled]
  );

  const handleHapticsToggle = useCallback(
    (value: boolean) => {
      if (!disabled) {
        setHapticFeedbackEnabled(value);
      }
    },
    [disabled]
  );

  const handleSoundToggle = useCallback(
    (value: boolean) => {
      if (!disabled) {
        setSoundEnabled(value);
      }
    },
    [disabled]
  );

  const handleVolumeIncrement = useCallback(() => {
    if (!disabled) {
      const newVolume = Math.min(1, soundVolume + 0.1);
      setSoundVolume(Math.round(newVolume * 10) / 10);
    }
  }, [disabled, soundVolume]);

  const handleVolumeDecrement = useCallback(() => {
    if (!disabled) {
      const newVolume = Math.max(0, soundVolume - 0.1);
      setSoundVolume(Math.round(newVolume * 10) / 10);
    }
  }, [disabled, soundVolume]);

  const handlePresetChange = useCallback(
    (preset: SoundPreset) => {
      if (!disabled) {
        setSoundPreset(preset);
      }
    },
    [disabled]
  );

  const handleTestSound = useCallback(() => {
    if (!disabled) {
      playSound('start');
    }
  }, [disabled, playSound]);

  return (
    <View style={styles.container}>
      {/* Reduced Motion Indicator */}
      {reducedMotion && (
        <View style={[styles.indicator, { backgroundColor: themeColors.warning + '15' }]}>
          <Icon name="alert" size={16} color={themeColors.warning} />
          <Text style={[styles.indicatorText, { color: themeColors.warning }]}>
            System reduced motion is enabled. Some animations are disabled.
          </Text>
        </View>
      )}

      {/* Animations Toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Animations</Text>
          <Text style={[styles.toggleDescription, { color: themeColors.textSecondary }]}>
            Enable smooth transitions and animations
          </Text>
        </View>
        <Switch
          value={animationsEnabled && !reducedMotion}
          onValueChange={handleAnimationsToggle}
          disabled={disabled || reducedMotion}
          trackColor={{ false: themeColors.surfaceVariant, true: themeColors.primary + '80' }}
          thumbColor={
            animationsEnabled && !reducedMotion ? themeColors.primary : themeColors.textMuted
          }
          accessibilityLabel="Toggle animations"
          accessibilityState={{
            checked: animationsEnabled && !reducedMotion,
            disabled: disabled || reducedMotion,
          }}
          accessibilityHint={
            reducedMotion
              ? 'Disabled because system reduced motion is enabled'
              : 'Enable or disable smooth transitions and animations'
          }
        />
      </View>

      {/* Haptic Feedback Toggle - Mobile only */}
      {isMobile && (
        <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: themeColors.border }]}>
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Haptic Feedback</Text>
            <Text style={[styles.toggleDescription, { color: themeColors.textSecondary }]}>
              Vibration feedback for button presses
            </Text>
          </View>
          <Switch
            value={hapticFeedbackEnabled}
            onValueChange={handleHapticsToggle}
            disabled={disabled}
            trackColor={{ false: themeColors.surfaceVariant, true: themeColors.primary + '80' }}
            thumbColor={hapticFeedbackEnabled ? themeColors.primary : themeColors.textMuted}
            accessibilityLabel="Toggle haptic feedback"
            accessibilityState={{ checked: hapticFeedbackEnabled, disabled }}
            accessibilityHint="Enable or disable vibration feedback for button presses"
          />
        </View>
      )}

      {/* Sound Settings */}
      {showSoundSettings && (
        <>
          {/* Sound Enable Toggle */}
          <View
            style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: themeColors.border }]}
          >
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Sounds</Text>
              <Text style={[styles.toggleDescription, { color: themeColors.textSecondary }]}>
                Play sounds for timer events
              </Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              disabled={disabled}
              trackColor={{ false: themeColors.surfaceVariant, true: themeColors.primary + '80' }}
              thumbColor={soundEnabled ? themeColors.primary : themeColors.textMuted}
              accessibilityLabel="Toggle sounds"
              accessibilityState={{ checked: soundEnabled, disabled }}
              accessibilityHint="Enable or disable sounds for timer events"
            />
          </View>

          {/* Sound Volume and Preset - only shown when sound is enabled */}
          {soundEnabled && (
            <View style={styles.soundSettingsGroup}>
              {/* Volume Control */}
              <View style={styles.stepperRow}>
                <Text style={[styles.stepperLabel, { color: themeColors.textSecondary }]}>
                  Volume
                </Text>
                <View style={styles.stepperControls}>
                  <Pressable
                    style={[
                      styles.stepperButton,
                      { backgroundColor: themeColors.surfaceVariant },
                      volumePercent <= 0 && styles.stepperButtonDisabled,
                    ]}
                    onPress={handleVolumeDecrement}
                    disabled={disabled || volumePercent <= 0}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease volume"
                  >
                    <Text
                      style={
                        StyleSheet.flatten([
                          styles.stepperButtonText,
                          { color: themeColors.text },
                          volumePercent <= 0 && styles.stepperButtonTextDisabled,
                        ]) as TextStyle
                      }
                    >
                      -
                    </Text>
                  </Pressable>
                  <Text style={[styles.stepperValue, { color: themeColors.text }]}>
                    {volumePercent}%
                  </Text>
                  <Pressable
                    style={[
                      styles.stepperButton,
                      { backgroundColor: themeColors.surfaceVariant },
                      volumePercent >= 100 && styles.stepperButtonDisabled,
                    ]}
                    onPress={handleVolumeIncrement}
                    disabled={disabled || volumePercent >= 100}
                    accessibilityRole="button"
                    accessibilityLabel="Increase volume"
                  >
                    <Text
                      style={
                        StyleSheet.flatten([
                          styles.stepperButtonText,
                          { color: themeColors.text },
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
                <Text style={[styles.presetSectionLabel, { color: themeColors.textSecondary }]}>
                  Sound Style
                </Text>
                <View style={styles.presetOptions}>
                  {SOUND_PRESETS.map(preset => (
                    <Pressable
                      key={preset}
                      style={[
                        styles.presetOption,
                        { backgroundColor: themeColors.surfaceVariant },
                        soundPreset === preset && [
                          styles.presetOptionActive,
                          {
                            borderColor: themeColors.primary,
                            backgroundColor: themeColors.primary + '10',
                          },
                        ],
                      ]}
                      onPress={() => handlePresetChange(preset)}
                      disabled={disabled}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: soundPreset === preset, disabled }}
                      accessibilityLabel={`${SOUND_PRESET_NAMES[preset]}: ${SOUND_PRESET_DESCRIPTIONS[preset]}`}
                    >
                      <Text
                        style={[
                          styles.presetOptionText,
                          { color: themeColors.text },
                          soundPreset === preset && { color: themeColors.primary },
                        ]}
                      >
                        {SOUND_PRESET_NAMES[preset]}
                      </Text>
                      <Text
                        style={[
                          styles.presetOptionDescription,
                          { color: themeColors.textMuted },
                          soundPreset === preset && { color: themeColors.primary + 'CC' },
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
                <Pressable
                  style={[styles.testButton, { backgroundColor: themeColors.surfaceVariant }]}
                  onPress={handleTestSound}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Test sound"
                >
                  <Text style={[styles.testButtonText, { color: themeColors.primary }]}>
                    Test Sound
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}

      {/* Help text when reduced motion is active */}
      {reducedMotion && (
        <Text style={[styles.helpText, { color: themeColors.textMuted }]}>
          To enable animations, turn off Reduce Motion in your system accessibility settings.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  indicatorText: {
    fontSize: fontSizes.sm,
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  toggleDescription: {
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  helpText: {
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // Sound settings styles
  soundSettingsGroup: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stepperLabel: {
    fontSize: fontSizes.sm,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    lineHeight: fontSizes.lg * 1.2,
  },
  stepperButtonTextDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
  presetSection: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  presetSectionLabel: {
    fontSize: fontSizes.sm,
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetOptionActive: {
    // borderColor and backgroundColor set dynamically
  },
  presetOptionText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  presetOptionDescription: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  testRow: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  testButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  testButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
});

export default UXSettings;
