import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  type TextStyle,
} from 'react-native';

import { Text, Icon } from '@/components/ui';
import { colors, spacing, borderRadius, fontSizes, fontWeights, shadows } from '@/theme';
import type { PomodoroSettingsData, PomodoroPreset } from '@/hooks';

export interface SessionSettings {
  workDurationSeconds: number;
  breakDurationSeconds: number;
  longBreakDurationSeconds: number;
  pomodorosBeforeLongBreak: number;
}

export interface TimerModeDropdownProps {
  pomodoroEnabled: boolean;
  onPomodoroEnabledChange: (enabled: boolean) => void;
  effectiveSettings: SessionSettings;
  onSettingsChange: (settings: SessionSettings) => void;
  presets: PomodoroPreset[];
  onSavePreset: (name: string, settings: Omit<PomodoroSettingsData, 'pomodoroEnabled'>) => void;
  onDeletePreset: (id: string) => void;
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

export function TimerModeDropdown({
  pomodoroEnabled,
  onPomodoroEnabledChange,
  effectiveSettings,
  onSettingsChange,
  presets,
  onSavePreset,
  onDeletePreset,
  disabled = false,
}: TimerModeDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [presetName, setPresetName] = useState('');
  const saveInputRef = useRef<TextInput>(null);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => !prev);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setShowSaveInput(false);
    setPresetName('');
  }, []);

  const handleSelectMode = useCallback(
    (mode: 'normal' | 'pomodoro') => {
      onPomodoroEnabledChange(mode === 'pomodoro');
      if (mode === 'normal') {
        closeDropdown();
      }
    },
    [onPomodoroEnabledChange, closeDropdown]
  );

  const workMinutes = Math.round(effectiveSettings.workDurationSeconds / 60);
  const breakMinutes = Math.round(effectiveSettings.breakDurationSeconds / 60);
  const longBreakMinutes = Math.round(effectiveSettings.longBreakDurationSeconds / 60);

  const handleApplyPreset = useCallback(
    (preset: PomodoroPreset) => {
      onSettingsChange({ ...preset.settings });
      onPomodoroEnabledChange(true);
    },
    [onSettingsChange, onPomodoroEnabledChange]
  );

  const handleSavePreset = useCallback(() => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    onSavePreset(trimmed, effectiveSettings);
    setPresetName('');
    setShowSaveInput(false);
  }, [presetName, effectiveSettings, onSavePreset]);

  const handleShowSaveInput = useCallback(() => {
    setShowSaveInput(true);
    setTimeout(() => saveInputRef.current?.focus(), 100);
  }, []);

  const modeLabel = pomodoroEnabled ? 'Pomodoro' : 'Timer';

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.headerButton}
        onPress={toggleDropdown}
        accessibilityRole="button"
        accessibilityLabel={`Timer mode: ${modeLabel}. Tap to change.`}
        disabled={disabled}
      >
        <Text variant="display" style={styles.headerTitle}>
          {modeLabel}
        </Text>
        {!disabled && (
          <Icon
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
            style={styles.headerChevron}
          />
        )}
      </Pressable>

      {isOpen && (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={closeDropdown}>
          <TouchableWithoutFeedback onPress={closeDropdown}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.dropdownPanel}>
                  {/* Mode selection */}
                  <Text style={styles.sectionLabel}>Mode</Text>
                  <View style={styles.modeRow}>
                    <Pressable
                      style={[styles.modeOption, !pomodoroEnabled && styles.modeOptionSelected]}
                      onPress={() => handleSelectMode('normal')}
                      accessibilityRole="button"
                    >
                      <Text
                        style={
                          StyleSheet.flatten([
                            styles.modeOptionText,
                            !pomodoroEnabled && styles.modeOptionTextSelected,
                          ]) as TextStyle
                        }
                      >
                        Timer
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modeOption, pomodoroEnabled && styles.modeOptionSelected]}
                      onPress={() => handleSelectMode('pomodoro')}
                      accessibilityRole="button"
                    >
                      <Text
                        style={
                          StyleSheet.flatten([
                            styles.modeOptionText,
                            pomodoroEnabled && styles.modeOptionTextSelected,
                          ]) as TextStyle
                        }
                      >
                        Pomodoro
                      </Text>
                    </Pressable>
                  </View>

                  {/* Pomodoro settings (shown when Pomodoro selected) */}
                  {pomodoroEnabled && (
                    <>
                      <View style={styles.divider} />
                      <Text style={styles.sectionLabel}>Session Settings</Text>
                      <View style={styles.settingsGroup}>
                        <StepperRow
                          label="Work Duration"
                          value={workMinutes}
                          min={1}
                          max={120}
                          onIncrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              workDurationSeconds: (workMinutes + 1) * 60,
                            })
                          }
                          onDecrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              workDurationSeconds: (workMinutes - 1) * 60,
                            })
                          }
                        />
                        <StepperRow
                          label="Short Break"
                          value={breakMinutes}
                          min={1}
                          max={60}
                          onIncrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              breakDurationSeconds: (breakMinutes + 1) * 60,
                            })
                          }
                          onDecrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              breakDurationSeconds: (breakMinutes - 1) * 60,
                            })
                          }
                        />
                        <StepperRow
                          label="Long Break"
                          value={longBreakMinutes}
                          min={1}
                          max={60}
                          onIncrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              longBreakDurationSeconds: (longBreakMinutes + 1) * 60,
                            })
                          }
                          onDecrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              longBreakDurationSeconds: (longBreakMinutes - 1) * 60,
                            })
                          }
                        />
                        <StepperRow
                          label="Cycles Before Long Break"
                          value={effectiveSettings.pomodorosBeforeLongBreak}
                          min={1}
                          max={10}
                          unit=""
                          onIncrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              pomodorosBeforeLongBreak:
                                effectiveSettings.pomodorosBeforeLongBreak + 1,
                            })
                          }
                          onDecrement={() =>
                            onSettingsChange({
                              ...effectiveSettings,
                              pomodorosBeforeLongBreak:
                                effectiveSettings.pomodorosBeforeLongBreak - 1,
                            })
                          }
                        />
                      </View>

                      {/* Presets */}
                      <View style={styles.divider} />
                      <Text style={styles.sectionLabel}>Presets</Text>
                      <View style={styles.presetsContainer}>
                        {presets.map(preset => (
                          <View key={preset.id} style={styles.presetRow}>
                            <Pressable
                              style={styles.presetChip}
                              onPress={() => handleApplyPreset(preset)}
                              accessibilityRole="button"
                              accessibilityLabel={`Apply preset: ${preset.name}`}
                            >
                              <Text style={styles.presetChipText}>{preset.name}</Text>
                            </Pressable>
                            {!preset.builtIn && (
                              <Pressable
                                style={styles.presetDeleteButton}
                                onPress={() => onDeletePreset(preset.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Delete preset: ${preset.name}`}
                              >
                                <Icon name="close" size={14} color={colors.textMuted} />
                              </Pressable>
                            )}
                          </View>
                        ))}
                      </View>

                      {/* Save as preset */}
                      {showSaveInput ? (
                        <View style={styles.saveInputRow}>
                          <TextInput
                            ref={saveInputRef}
                            style={styles.saveInput}
                            placeholder="Preset name..."
                            placeholderTextColor={colors.textMuted}
                            value={presetName}
                            onChangeText={setPresetName}
                            onSubmitEditing={handleSavePreset}
                            maxLength={40}
                          />
                          <Pressable
                            style={[
                              styles.saveButton,
                              !presetName.trim() && styles.saveButtonDisabled,
                            ]}
                            onPress={handleSavePreset}
                            disabled={!presetName.trim()}
                            accessibilityRole="button"
                          >
                            <Text
                              style={
                                StyleSheet.flatten([
                                  styles.saveButtonText,
                                  !presetName.trim() && styles.saveButtonTextDisabled,
                                ]) as TextStyle
                              }
                            >
                              Save
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.saveAsPresetButton}
                          onPress={handleShowSaveInput}
                          accessibilityRole="button"
                        >
                          <Icon name="add" size={16} color={colors.primary} />
                          <Text style={styles.saveAsPresetText}>Save as Preset</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 28,
  },
  headerChevron: {
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: spacing.md,
  },
  dropdownPanel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.md,
  },
  sectionLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
  },
  modeOptionSelected: {
    backgroundColor: colors.primary,
  },
  modeOptionText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    fontWeight: fontWeights.medium,
  },
  modeOptionTextSelected: {
    color: colors.text,
    fontWeight: fontWeights.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  settingsGroup: {
    gap: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * 1.2,
  },
  stepperButtonTextDisabled: {
    color: colors.textMuted,
  },
  stepperValue: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: fontWeights.medium,
    minWidth: 50,
    textAlign: 'center',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
  },
  presetChipText: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: fontWeights.medium,
  },
  presetDeleteButton: {
    marginLeft: 2,
    padding: spacing.xs,
  },
  saveAsPresetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  saveAsPresetText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  saveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveInput: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    color: colors.text,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSizes.sm,
  },
  saveButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: fontWeights.semibold,
  },
  saveButtonTextDisabled: {
    color: colors.textMuted,
  },
});

export default TimerModeDropdown;
