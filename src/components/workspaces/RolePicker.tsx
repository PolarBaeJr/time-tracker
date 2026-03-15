/**
 * RolePicker Component
 *
 * Reusable role selection component for workspace member roles.
 * Displays admin and member options with descriptions.
 * Owner role is shown as disabled/non-selectable.
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { Text, Icon } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import type { WorkspaceRole } from '@/schemas';

/**
 * Role option configuration
 */
interface RoleOption {
  value: WorkspaceRole;
  label: string;
  description: string;
}

/**
 * Available role options for selection
 * Owner is excluded from selection (ownership is transferred separately)
 */
const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Can invite members, manage projects, and approve entries',
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Can log time, view shared projects, and participate in feed',
  },
];

/**
 * Props for RolePicker component
 */
export interface RolePickerProps {
  /** Currently selected role */
  value: WorkspaceRole;
  /** Callback when role changes */
  onChange: (role: WorkspaceRole) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Whether this is for the workspace owner (shows owner role, disabled) */
  isOwner?: boolean;
  /** Label to display above the picker */
  label?: string;
  /** Error message to display */
  error?: string;
}

/**
 * Individual role option button
 */
function RoleOptionButton({
  option,
  isSelected,
  onSelect,
  disabled,
}: {
  option: RoleOption;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled }}
      accessibilityLabel={`${option.label}: ${option.description}`}
      style={({ pressed }) => [
        styles.optionButton,
        {
          backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
          borderColor: isSelected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.optionContent}>
        <View style={styles.optionHeader}>
          <View
            style={[
              styles.radioCircle,
              {
                borderColor: isSelected ? colors.text : colors.textMuted,
                backgroundColor: isSelected ? colors.text : 'transparent',
              },
            ]}
          >
            {isSelected && (
              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Text
            variant="body"
            bold
            style={{ color: isSelected ? colors.text : colors.textSecondary }}
          >
            {option.label}
          </Text>
        </View>
        <Text
          variant="caption"
          color={isSelected ? 'secondary' : 'muted'}
          style={styles.optionDescription}
        >
          {option.description}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * RolePicker Component
 *
 * A role selection component for choosing between Admin and Member roles.
 *
 * @example
 * ```tsx
 * <RolePicker
 *   value={selectedRole}
 *   onChange={setSelectedRole}
 *   label="Role"
 * />
 * ```
 *
 * @example
 * ```tsx
 * // For workspace owner (shows disabled owner badge)
 * <RolePicker
 *   value="owner"
 *   onChange={() => {}}
 *   isOwner
 *   disabled
 * />
 * ```
 */
export function RolePicker({
  value,
  onChange,
  disabled = false,
  isOwner = false,
  label,
  error,
}: RolePickerProps): React.ReactElement {
  const { colors } = useTheme();

  const handleSelect = useCallback(
    (role: WorkspaceRole) => {
      if (!disabled) {
        onChange(role);
      }
    },
    [disabled, onChange]
  );

  // If this is the owner, show a special disabled badge
  if (isOwner) {
    return (
      <View style={styles.container}>
        {label && (
          <Text variant="body" bold style={styles.label}>
            {label}
          </Text>
        )}
        <View
          style={[
            styles.ownerBadge,
            { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
          ]}
        >
          <Icon name="star" size={16} color={colors.primary} />
          <Text variant="body" bold style={{ color: colors.primary, marginLeft: spacing.xs }}>
            Owner
          </Text>
          <Text variant="caption" color="muted" style={{ marginLeft: spacing.sm }}>
            (Cannot be changed)
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="body" bold style={styles.label}>
          {label}
        </Text>
      )}
      <View style={styles.optionsContainer} accessibilityRole="radiogroup">
        {ROLE_OPTIONS.map(option => (
          <RoleOptionButton
            key={option.value}
            option={option}
            isSelected={value === option.value}
            onSelect={() => handleSelect(option.value)}
            disabled={disabled}
          />
        ))}
      </View>
      {error && (
        <Text variant="caption" style={[styles.errorText, { color: colors.error }]}>
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
    marginBottom: spacing.sm,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionDescription: {
    marginTop: spacing.xs,
    marginLeft: 26, // Align with text after radio
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    marginTop: spacing.xs,
  },
});

export default RolePicker;
