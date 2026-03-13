/**
 * SettingsNavLink
 *
 * Navigation link component for Settings screen.
 * Provides styled buttons to navigate to sub-screens like Categories and Goals.
 */

import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Text, Icon, type IconName } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export interface SettingsNavLinkProps {
  /** The screen to navigate to */
  screen: 'Categories' | 'Goals';
  /** Icon to display */
  icon: IconName;
  /** Title text */
  title: string;
  /** Subtitle/description text */
  subtitle: string;
  /** Whether the link is disabled */
  disabled?: boolean;
}

/**
 * SettingsNavLink Component
 *
 * A styled navigation link for the Settings screen that navigates to
 * sub-screens in the root stack (Categories, Goals).
 *
 * @example
 * ```tsx
 * <SettingsNavLink
 *   screen="Categories"
 *   icon="folder"
 *   title="Categories"
 *   subtitle="Manage your time tracking categories"
 * />
 * ```
 */
export function SettingsNavLink({
  screen,
  icon,
  title,
  subtitle,
  disabled = false,
}: SettingsNavLinkProps): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();

  const handlePress = React.useCallback(() => {
    if (!disabled) {
      navigation.navigate(screen);
    }
  }, [navigation, screen, disabled]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${subtitle}`}
      accessibilityState={{ disabled }}
    >
      <View style={styles.iconContainer}>
        <Icon name={icon} size={24} color={disabled ? colors.textMuted : colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
        <Text style={[styles.subtitle, disabled && styles.disabledText]}>{subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: colors.surfaceVariant,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  disabledText: {
    color: colors.textMuted,
  },
});

export default SettingsNavLink;
