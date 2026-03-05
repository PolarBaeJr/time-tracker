/**
 * ColorPicker component with preset palette and custom hex input
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { Input } from './Input';
import { colors, spacing, borderRadius } from '@/theme';

/**
 * Preset color palette (12 colors)
 */
export const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
] as const;

/**
 * ColorPicker component props
 */
export interface ColorPickerProps {
  /** Currently selected color (hex string) */
  value: string;
  /** Callback when color changes */
  onChange: (color: string) => void;
  /** Label for the picker */
  label?: string;
  /** Whether to show custom hex input */
  showCustomInput?: boolean;
  /** Error message */
  error?: string;
  /** Additional styles for the container */
  style?: ViewStyle;
}

/**
 * Validate hex color string
 */
function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Normalize hex color (uppercase, ensure # prefix)
 */
function normalizeHex(color: string): string {
  let hex = color.trim();
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }
  return hex.toUpperCase();
}

/**
 * ColorPicker component for selecting colors
 *
 * @example
 * ```tsx
 * const [color, setColor] = useState('#6366F1');
 *
 * <ColorPicker
 *   label="Category Color"
 *   value={color}
 *   onChange={setColor}
 * />
 * ```
 */
export function ColorPicker({
  value,
  onChange,
  label,
  showCustomInput = true,
  error,
  style,
}: ColorPickerProps): React.ReactElement {
  const [customHex, setCustomHex] = useState('');
  const [showingCustom, setShowingCustom] = useState(false);

  // Check if current value is a preset color
  const isPreset = PRESET_COLORS.includes(value.toUpperCase() as (typeof PRESET_COLORS)[number]);

  // Handle preset color selection
  const handlePresetSelect = useCallback((color: string) => {
    onChange(color);
    setShowingCustom(false);
    setCustomHex('');
  }, [onChange]);

  // Handle custom hex input change
  const handleCustomChange = useCallback((text: string) => {
    const normalized = normalizeHex(text);
    setCustomHex(text);

    if (isValidHex(normalized)) {
      onChange(normalized);
    }
  }, [onChange]);

  // Handle toggling custom input
  const handleToggleCustom = useCallback(() => {
    if (showingCustom) {
      // Closing custom input - clear it
      setShowingCustom(false);
      setCustomHex('');
    } else {
      // Opening custom input - prefill with current value if not preset
      setShowingCustom(true);
      setCustomHex(isPreset ? '' : value);
    }
  }, [showingCustom, isPreset, value]);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      )}

      {/* Selected color preview */}
      <View style={styles.previewRow}>
        <View
          style={[
            styles.previewSwatch,
            { backgroundColor: isValidHex(value) ? value : colors.surface },
          ]}
        />
        <Text variant="bodySmall" color="secondary" style={styles.previewText}>
          {value}
        </Text>
      </View>

      {/* Preset color palette */}
      <View style={styles.palette}>
        {PRESET_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => handlePresetSelect(color)}
            accessibilityRole="button"
            accessibilityLabel={`Select color ${color}`}
            accessibilityState={{ selected: value.toUpperCase() === color }}
            style={[
              styles.swatch,
              { backgroundColor: color },
              value.toUpperCase() === color && styles.swatchSelected,
            ]}
          />
        ))}
      </View>

      {/* Custom hex toggle */}
      {showCustomInput && (
        <Pressable
          onPress={handleToggleCustom}
          accessibilityRole="button"
          style={styles.customToggle}
        >
          <Text variant="label" color="primary">
            {showingCustom ? 'Hide custom color' : 'Enter custom color'}
          </Text>
        </Pressable>
      )}

      {/* Custom hex input */}
      {showingCustom && (
        <Input
          label="Custom Hex Color"
          placeholder="#000000"
          value={customHex}
          onChangeText={handleCustomChange}
          autoCapitalize="characters"
          maxLength={7}
          error={customHex && !isValidHex(normalizeHex(customHex)) ? 'Invalid hex color' : undefined}
        />
      )}

      {/* Error message */}
      {error && (
        <Text variant="caption" color="error" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewSwatch: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  previewText: {
    marginLeft: spacing.sm,
    fontFamily: 'monospace',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.text,
    borderWidth: 3,
  },
  customToggle: {
    paddingVertical: spacing.xs,
  },
  error: {
    marginTop: spacing.xs,
  },
});

export default ColorPicker;
