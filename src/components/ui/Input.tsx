/**
 * Input component with label, error message, and themed styling
 *
 * Features:
 * - Floating label animation (label moves up on focus)
 * - Border color transition animation on focus
 * - Shake animation on error
 * - Success checkmark animation (optional)
 * - Respects reduced motion preferences
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontSizes, fontWeights, borderRadius } from '@/theme';
import {
  shake,
  fade,
  interpolateColor,
  getReducedMotionPreference,
  ANIMATION_DURATION,
  ANIMATION_PRESETS,
} from '@/lib/animations';

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
  /** Show success checkmark with animation */
  showSuccess?: boolean;
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
  showSuccess = false,
  containerStyle,
  inputStyle,
  labelStyle,
  multiline,
  secureTextEntry,
  placeholder,
  placeholderTextColor,
  editable,
  onFocus,
  onBlur,
  value,
  ...textInputProps
}: InputProps): React.ReactElement {
  const { colors } = useTheme();
  const hasError = Boolean(error);
  const isEditable = editable !== false && !disabled;

  // Track focus state
  const [isFocused, setIsFocused] = useState(false);

  // Animation values - use useState with lazy initializer for React Compiler compatibility
  const [labelAnim] = useState(() => new Animated.Value(0));
  const [borderColorAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const [successAnim] = useState(() => new Animated.Value(0));

  // Track animation refs for cleanup
  const shakeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const successAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Track previous error to detect new errors
  const prevErrorRef = useRef<string | undefined>(undefined);

  // Should we animate?
  const shouldAnimate = !getReducedMotionPreference();

  // Determine if label should float (focused or has value)
  const hasValue = Boolean(value && String(value).length > 0);
  const shouldFloat = isFocused || hasValue;

  // Handle focus state change - animate label and border
  useEffect(() => {
    if (!shouldAnimate) {
      labelAnim.setValue(shouldFloat ? 1 : 0);
      borderColorAnim.setValue(isFocused ? 1 : 0);
      return;
    }

    // Animate label position
    Animated.timing(labelAnim, {
      toValue: shouldFloat ? 1 : 0,
      duration: ANIMATION_DURATION.fast,
      useNativeDriver: false, // Can't use native driver for layout properties
    }).start();

    // Animate border color
    Animated.timing(borderColorAnim, {
      toValue: isFocused ? 1 : 0,
      duration: ANIMATION_DURATION.fast,
      useNativeDriver: false, // Can't use native driver for colors
    }).start();
  }, [shouldFloat, isFocused, labelAnim, borderColorAnim, shouldAnimate]);

  // Handle error shake animation
  useEffect(() => {
    // Only shake when error appears (not on mount, not when error disappears)
    if (error && error !== prevErrorRef.current && shouldAnimate) {
      // Stop any existing shake
      if (shakeAnimRef.current) {
        shakeAnimRef.current.stop();
      }

      // Reset and start shake animation
      shakeAnim.setValue(0);
      const shakeAnimation = shake(shakeAnim, ANIMATION_PRESETS.error);
      shakeAnimRef.current = shakeAnimation;
      shakeAnimation.start(() => {
        shakeAnimRef.current = null;
      });
    }

    prevErrorRef.current = error;
  }, [error, shakeAnim, shouldAnimate]);

  // Handle success animation
  useEffect(() => {
    if (showSuccess) {
      if (shouldAnimate) {
        // Stop any existing animation
        if (successAnimRef.current) {
          successAnimRef.current.stop();
        }

        // Fade in success checkmark
        successAnim.setValue(0);
        const fadeAnimation = fade(successAnim, 1, { duration: ANIMATION_DURATION.normal });
        successAnimRef.current = fadeAnimation;
        fadeAnimation.start(() => {
          successAnimRef.current = null;
        });
      } else {
        successAnim.setValue(1);
      }
    } else {
      // Fade out or reset immediately
      if (shouldAnimate) {
        const fadeAnimation = fade(successAnim, 0, { duration: ANIMATION_DURATION.fast });
        fadeAnimation.start();
      } else {
        successAnim.setValue(0);
      }
    }
  }, [showSuccess, successAnim, shouldAnimate]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      if (shakeAnimRef.current) {
        shakeAnimRef.current.stop();
      }
      if (successAnimRef.current) {
        successAnimRef.current.stop();
      }
    };
  }, []);

  // Handle focus event
  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  // Handle blur event
  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  // Interpolate label position (translateY)
  const labelTranslateY = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  // Interpolate label scale
  const labelScale = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  // Interpolate border color
  const borderColor = hasError
    ? colors.error
    : interpolateColor(borderColorAnim, colors.border, colors.primary);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: shakeAnim }] }, containerStyle]}
    >
      {label && (
        <Animated.Text
          style={[
            styles.label,
            { color: colors.text },
            {
              transform: [{ translateY: labelTranslateY }, { scale: labelScale }],
            },
            disabled && { color: colors.textMuted },
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
      )}
      <View style={styles.inputWrapper}>
        <Animated.View
          style={[
            styles.inputContainer,
            {
              backgroundColor: disabled ? colors.surface : colors.surfaceVariant,
              borderColor: borderColor,
            },
            multiline && styles.inputMultiline,
          ]}
        >
          <TextInput
            {...textInputProps}
            value={value}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor ?? colors.textMuted}
            editable={isEditable}
            multiline={multiline}
            secureTextEntry={secureTextEntry}
            accessibilityLabel={label}
            accessibilityState={{
              disabled: !isEditable,
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[
              styles.input,
              { color: colors.text },
              disabled && { color: colors.textMuted },
              inputStyle,
            ]}
          />
        </Animated.View>

        {/* Success checkmark */}
        {showSuccess && (
          <Animated.View style={[styles.successIcon, { opacity: successAnim }]}>
            <Text style={[styles.checkmark, { color: colors.success }]}>✓</Text>
          </Animated.View>
        )}
      </View>
      {hasError && (
        <Text style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {!hasError && helperText && (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>{helperText}</Text>
      )}
    </Animated.View>
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
    transformOrigin: 'left center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
  },
  inputMultiline: {
    height: 'auto',
    minHeight: 100,
  },
  successIcon: {
    position: 'absolute',
    right: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
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
