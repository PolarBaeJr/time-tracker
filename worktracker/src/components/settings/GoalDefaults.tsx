/**
 * GoalDefaults component
 *
 * Input for default monthly goal hours.
 * Used to set the default hours for new monthly goals.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Button } from '@/components/ui';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '@/theme';
import { storage } from '@/lib';

/**
 * Storage key for default goal hours
 */
const GOAL_DEFAULTS_KEY = 'worktracker.settings.defaultGoalHours';

export interface GoalDefaultsProps {
  /** Additional styles */
  style?: ViewStyle;
}

/**
 * GoalDefaults component
 *
 * @example
 * ```tsx
 * <GoalDefaults />
 * ```
 */
export function GoalDefaults({
  style,
}: GoalDefaultsProps): React.ReactElement {
  const [defaultHours, setDefaultHours] = useState<string>('40');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load saved default hours on mount
  useEffect(() => {
    const loadDefaultHours = async () => {
      try {
        const saved = await storage.getItem(GOAL_DEFAULTS_KEY);
        if (saved) {
          setDefaultHours(saved);
        }
      } catch (error) {
        console.error('Failed to load default goal hours:', error);
      }
    };

    void loadDefaultHours();
  }, []);

  // Validate input - only allow positive numbers
  const handleChangeText = useCallback((text: string) => {
    // Allow empty string for editing
    if (text === '') {
      setDefaultHours('');
      return;
    }

    // Allow valid decimal numbers
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return;
    }

    // Limit to reasonable precision (2 decimal places)
    if (parts[1] && parts[1].length > 2) {
      return;
    }

    // Parse and validate
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0 && num <= 744) {
      // Max ~744 hours in a month (31 days * 24 hours)
      setDefaultHours(cleaned);
    }
  }, []);

  // Save default hours
  const handleSave = useCallback(async () => {
    const hours = parseFloat(defaultHours);

    if (isNaN(hours) || hours <= 0) {
      setSaveMessage('Please enter a valid number greater than 0');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await storage.setItem(GOAL_DEFAULTS_KEY, defaultHours);
      setSaveMessage('Default saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save default goal hours:', error);
      setSaveMessage('Failed to save');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [defaultHours]);

  const hours = parseFloat(defaultHours);
  const isValid = !isNaN(hours) && hours > 0 && hours <= 744;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Default Monthly Goal</Text>
      <Text style={styles.helperText}>
        Set a default target when creating new monthly goals
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, !isValid && defaultHours !== '' && styles.inputError]}
          value={defaultHours}
          onChangeText={handleChangeText}
          keyboardType="decimal-pad"
          placeholder="40"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Default monthly goal hours"
          accessibilityHint="Enter the default number of hours for new monthly goals"
        />
        <Text style={styles.unitLabel}>hours / month</Text>
      </View>

      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Preview:</Text>
        {isValid ? (
          <Text style={styles.previewText}>
            {hours.toFixed(1)} hours = ~{(hours / 4).toFixed(1)} hours/week = ~{(hours / 30).toFixed(1)} hours/day
          </Text>
        ) : (
          <Text style={styles.previewTextInvalid}>
            Enter a valid number
          </Text>
        )}
      </View>

      <View style={styles.saveRow}>
        <Button
          variant="secondary"
          size="sm"
          onPress={handleSave}
          disabled={!isValid || isSaving}
          loading={isSaving}
        >
          Save Default
        </Button>
        {saveMessage && (
          <Text
            style={[
              styles.saveMessage,
              saveMessage.includes('success') && styles.saveMessageSuccess,
              saveMessage.includes('Failed') && styles.saveMessageError,
            ]}
          >
            {saveMessage}
          </Text>
        )}
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    width: 100,
    height: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.error,
  },
  unitLabel: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  previewContainer: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewLabel: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  previewText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  previewTextInvalid: {
    fontSize: fontSizes.sm,
    color: colors.error,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  saveMessage: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  saveMessageSuccess: {
    color: colors.success,
  },
  saveMessageError: {
    color: colors.error,
  },
});

export default GoalDefaults;
