/**
 * AccountSection component
 *
 * Shows user email, profile photo, and sign out button.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import { View, Text, Image, Alert, Platform, StyleSheet, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '@/theme';

export interface AccountSectionProps {
  /** User email address */
  email: string | null;
  /** User display name */
  name: string | null;
  /** User avatar URL (from OAuth provider) */
  avatarUrl?: string | null;
  /** Callback when sign out is pressed */
  onSignOut: () => Promise<void>;
  /** Additional styles */
  style?: ViewStyle;
}

/**
 * Generate initials from name or email
 */
function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return '?';
}

/**
 * AccountSection component
 *
 * @example
 * ```tsx
 * <AccountSection
 *   email={user.email}
 *   name={user.name}
 *   avatarUrl={user.user_metadata?.avatar_url}
 *   onSignOut={handleSignOut}
 * />
 * ```
 */
export function AccountSection({
  email,
  name,
  avatarUrl,
  onSignOut,
  style,
}: AccountSectionProps): React.ReactElement {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSignOut = useCallback(() => {
    const performSignOut = async () => {
      setIsSigningOut(true);
      try {
        await onSignOut();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign out failed';
        if (Platform.OS === 'web') {
          alert(message);
        } else {
          Alert.alert('Error', message);
        }
      } finally {
        setIsSigningOut(false);
      }
    };

    // Confirm sign out
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        void performSignOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => void performSignOut(),
        },
      ]);
    }
  }, [onSignOut]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const showAvatar = avatarUrl && !imageError;
  const initials = getInitials(name, email);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Account</Text>

      <View style={styles.card}>
        <View style={styles.profileRow}>
          {/* Avatar or initials */}
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                onError={handleImageError}
                accessibilityLabel="Profile photo"
              />
            ) : (
              <View style={styles.initialsContainer}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
            )}
          </View>

          {/* User info */}
          <View style={styles.userInfo}>
            {name && (
              <Text style={styles.userName} numberOfLines={1}>
                {name}
              </Text>
            )}
            {email && (
              <Text style={styles.userEmail} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
        </View>

        {/* Sign out button */}
        <View style={styles.signOutContainer}>
          <Button
            variant="danger"
            size="md"
            onPress={handleSignOut}
            loading={isSigningOut}
            disabled={isSigningOut}
            accessibilityLabel="Sign out"
            accessibilityHint="Sign out of your account"
          >
            Sign Out
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    ...Platform.select({
      ios: { letterSpacing: 0.5 },
      default: { letterSpacing: 0.5 },
      android: {},
    }),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceVariant,
  },
  initialsContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  signOutContainer: {
    alignItems: 'flex-start',
  },
});

export default AccountSection;
