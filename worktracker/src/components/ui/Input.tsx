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
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '@/theme';

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

/**
 * Input component for text entry with label and validation support
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email"
 *   placeholder="Enter your email"
 *   keyboardType="email-address"
 * />
 *
 * <Input
 *   label="Password"
 *   secureTextEntry
 *   error="Password is required"
 * />
 *
 * <Input
 *   label="Notes"
 *   multiline
 *   numberOfLines={4}
 *   placeholder="Add notes..."
 * />
 * ```
 */
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
  placeholderTextColor = colors.textMuted,
  editable,
  ...textInputProps
}: InputProps): React.ReactElement {
  const hasError = Boolean(error);
  const isEditable = editable !== false && !disabled;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            disabled && styles.labelDisabled,
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...textInputProps}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        editable={isEditable}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label}
        accessibilityState={{
          disabled: !isEditable,
        }}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
          inputStyle,
        ]}
      />
      {hasError && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {!hasError && helperText && (
        <Text style={styles.helperText}>{helperText}</Text>
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  input: {
    height: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fontSizes.md,
  },
  inputMultiline: {
    height: 'auto',
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.surface,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: fontSizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

export default Input;
