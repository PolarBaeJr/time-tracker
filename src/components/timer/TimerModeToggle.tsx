import * as React from 'react';
import { View, StyleSheet, Pressable, type ViewStyle, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import type { TimerMode } from '@/types';

export interface TimerModeToggleProps {
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function TimerModeToggle({
  mode,
  onModeChange,
  disabled = false,
  style,
}: TimerModeToggleProps): React.ReactElement {
  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={[styles.option, mode === 'normal' && styles.optionActive]}
        onPress={() => onModeChange('normal')}
        disabled={disabled}
      >
        <Text
          variant="bodySmall"
          style={
            StyleSheet.flatten([
              styles.optionText,
              mode === 'normal' && styles.optionTextActive,
            ]) as TextStyle
          }
        >
          Normal
        </Text>
      </Pressable>
      <Pressable
        style={[styles.option, mode === 'pomodoro' && styles.optionActive]}
        onPress={() => onModeChange('pomodoro')}
        disabled={disabled}
      >
        <Text
          variant="bodySmall"
          style={
            StyleSheet.flatten([
              styles.optionText,
              mode === 'pomodoro' && styles.optionTextActive,
            ]) as TextStyle
          }
        >
          Pomodoro
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md - 2,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  optionTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
});

export default TimerModeToggle;
