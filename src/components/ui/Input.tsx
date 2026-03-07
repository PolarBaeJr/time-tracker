/**
 * Input component with label, error message, and themed styling
 */

import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontSizes, fontWeights, borderRadius } from '@/theme';

/**
 * Input component props
 */
export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (when no error) */
  helperText?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional styles for the container */
  containerStyle?: ViewStyle;
  /** Additional styles for the input */
  inputStyle?: TextStyle;
  /** Additional styles for the label */
  labelStyle?: TextStyle;
}

export function Input({
  label,
  error,
  helperText,
  disabled = false,
  containerStyle,
  inputStyle,
  labelStyle,
  multiline,
  secureTextEntry,
  placeholder,
  placeholderTextColor,
  editable,
  ...textInputProps
}: InputProps): React.ReactElement {
  const { colors } = useTheme();
  const hasError = Boolean(error);
  const isEditable = editable !== false && !disabled;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: colors.text },
            disabled && { color: colors.textMuted },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...textInputProps}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        editable={isEditable}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label}
        accessibilityState={{
          disabled: !isEditable,
        }}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceVariant,
            borderColor: colors.border,
            color: colors.text,
          },
          multiline && styles.inputMultiline,
          hasError && { borderColor: colors.error },
          disabled && { backgroundColor: colors.surface, color: colors.textMuted },
          inputStyle,
        ]}
      />
      {hasError && (
        <Text style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {!hasError && helperText && (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>{helperText}</Text>
      )}
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
  input: {
    height: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: fontSizes.md,
  },
  inputMultiline: {
    height: 'auto',
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  errorText: {
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
});

export default Input;
