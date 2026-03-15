/**
 * RolePicker Component
 *
 * Reusable dropdown/selector for picking workspace/project roles.
 * Used in member management for changing roles.
 *
 * USAGE:
 * ```tsx
 * <RolePicker
 *   value="member"
 *   onChange={(role) => handleRoleChange(role)}
 *   onClose={() => setShowPicker(false)}
 *   excludeOwner
 * />
 * ```
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Text, Card } from '@/components/ui';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';
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
 * Available role options
 */
const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full control, can delete the project',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Can manage members and settings',
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Can view and log time',
  },
];

/**
 * Props for RolePicker component
 */
export interface RolePickerProps {
  /** Currently selected role */
  value: WorkspaceRole;
  /** Callback when role is selected */
  onChange: (role: WorkspaceRole) => void;
  /** Callback to close the picker */
  onClose: () => void;
  /** Exclude owner role from options */
  excludeOwner?: boolean;
  /** Disabled roles (cannot be selected) */
  disabledRoles?: WorkspaceRole[];
}

/**
 * RolePicker component for selecting workspace/project roles
 */
export function RolePicker({
  value,
  onChange,
  onClose,
  excludeOwner = false,
  disabledRoles = [],
}: RolePickerProps): React.ReactElement {
  const { colors } = useTheme();

  // Filter options based on excludeOwner prop
  const options = excludeOwner ? ROLE_OPTIONS.filter(opt => opt.value !== 'owner') : ROLE_OPTIONS;

  /**
   * Handle role selection
   */
  const handleSelect = useCallback(
    (role: WorkspaceRole) => {
      if (disabledRoles.includes(role)) return;
      onChange(role);
    },
    [onChange, disabledRoles]
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <View style={styles.container}>
          <Card padding="none" elevation="lg" style={styles.picker}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text variant="label">Select Role</Text>
            </View>

            {options.map((option, index) => {
              const isSelected = value === option.value;
              const isDisabled = disabledRoles.includes(option.value);
              const isLast = index === options.length - 1;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  disabled={isDisabled}
                  style={({ pressed }) => [
                    styles.option,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.surfaceVariant },
                    pressed && !isDisabled && { backgroundColor: colors.overlayLight },
                    isDisabled && styles.optionDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                  accessibilityLabel={`${option.label}: ${option.description}`}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionHeader}>
                      <Text
                        variant="body"
                        bold={isSelected}
                        color={isDisabled ? 'muted' : undefined}
                      >
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Text variant="body" color="primary">
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text variant="caption" color={isDisabled ? 'muted' : 'secondary'}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {/* Cancel button */}
            <Pressable
              onPress={onClose}
              style={[styles.cancelButton, { borderTopColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text variant="body" color="primary" center>
                Cancel
              </Text>
            </Pressable>
          </Card>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 320,
  },
  picker: {
    overflow: 'hidden',
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
});

export default RolePicker;
