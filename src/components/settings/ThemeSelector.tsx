/**
 * ThemeSelector component
 *
 * Three-segment selector for choosing between Light, Dark, and System themes.
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontSizes, fontWeights, borderRadius } from '@/theme';
import { useThemePreference, setThemeMode, type ThemeMode } from '@/stores/themeStore';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export interface ThemeSelectorProps {
  disabled?: boolean;
  style?: ViewStyle;
}

export function ThemeSelector({ disabled = false, style }: ThemeSelectorProps): React.ReactElement {
  const { colors } = useTheme();
  const currentMode = useThemePreference(s => s.mode);

  const handlePress = useCallback(
    (mode: ThemeMode) => {
      if (!disabled) {
        setThemeMode(mode);
      }
    },
    [disabled]
  );

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: colors.text }]}>Theme</Text>
      <Text style={[styles.helperText, { color: colors.textSecondary }]}>
        Choose your preferred appearance
      </Text>

      <View
        style={[
          styles.segmentContainer,
          { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
        ]}
      >
        {THEME_OPTIONS.map(option => {
          const isSelected = option.value === currentMode;

          return (
            <Pressable
              key={option.value}
              onPress={() => handlePress(option.value)}
              disabled={disabled}
              style={[
                styles.segment,
                isSelected && [styles.segmentSelected, { backgroundColor: colors.primary }],
                disabled && styles.segmentDisabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{
                selected: isSelected,
                disabled,
              }}
              accessibilityLabel={`${option.label} theme${isSelected ? ', selected' : ''}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  isSelected && styles.segmentTextSelected,
                  disabled && { color: colors.textMuted },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: fontSizes.sm,
    marginBottom: spacing.md,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md - 2,
  },
  segmentSelected: {
    borderRadius: borderRadius.md - 2,
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  segmentTextSelected: {
    color: '#FFFFFF',
    fontWeight: fontWeights.bold,
  },
});

export default ThemeSelector;
