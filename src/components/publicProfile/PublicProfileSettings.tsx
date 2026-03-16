/**
 * PublicProfileSettings Component
 *
 * Allows users to enable/disable their public profile and set a custom slug.
 * Includes slug validation, availability checking, and preview link.
 */

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, Switch, Pressable, Alert, Platform, TextInput } from 'react-native';

import { Text, Button, Icon, Spinner, Card } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import {
  useUpdatePublicProfileSettings,
  isValidSlug,
  checkSlugAvailability,
} from '@/hooks/usePublicProfile';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useAuth } from '@/hooks';
import { copyToClipboard } from '@/utils/clipboard';

/**
 * Props for PublicProfileSettings component
 */
export interface PublicProfileSettingsProps {
  /** Whether the settings are disabled */
  disabled?: boolean;
  /** Callback when settings are saved */
  onSave?: () => void;
}

/**
 * Get the base URL for public profiles
 */
function getPublicProfileBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/u/`;
  }
  // For native, use a default web URL
  return 'https://worktracker.app/u/';
}

/**
 * Extended settings type with public profile fields
 * These fields may not be in the base schema yet, so we cast to this type
 */
interface ExtendedSettings {
  public_profile_enabled?: boolean;
  public_profile_slug?: string;
}

/**
 * PublicProfileSettings component
 *
 * @example
 * ```tsx
 * <PublicProfileSettings
 *   disabled={isUpdating}
 *   onSave={() => console.log('Settings saved')}
 * />
 * ```
 */
export function PublicProfileSettings({
  disabled = false,
  onSave,
}: PublicProfileSettingsProps): React.ReactElement {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { settings } = useUserSettings({ userId: user?.id, enabled: !!user?.id });

  // Cast settings to extended type to access public profile fields
  const extendedSettings = settings as (typeof settings & ExtendedSettings) | undefined;

  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from settings
  useEffect(() => {
    if (extendedSettings) {
      setEnabled(extendedSettings.public_profile_enabled ?? false);
      setSlug(extendedSettings.public_profile_slug ?? '');
    }
  }, [extendedSettings]);

  // Update mutation
  const updateSettings = useUpdatePublicProfileSettings({
    onSuccess: () => {
      setHasChanges(false);
      onSave?.();
      if (Platform.OS === 'web') {
        alert('Public profile settings saved successfully.');
      } else {
        Alert.alert('Success', 'Public profile settings saved successfully.');
      }
    },
    onError: error => {
      const message = error.message || 'Failed to update settings.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  // Validate slug when it changes
  useEffect(() => {
    if (!slug) {
      setSlugError(null);
      return;
    }

    // Basic format validation
    if (!isValidSlug(slug)) {
      setSlugError('Must be 3-30 characters, lowercase letters, numbers, and hyphens only.');
      return;
    }

    // Check availability (debounced)
    const timer = setTimeout(async () => {
      setIsCheckingSlug(true);
      setSlugError(null);

      try {
        const isAvailable = await checkSlugAvailability(slug);
        // Only show error if slug is taken and it's different from user's current slug
        if (!isAvailable && slug !== extendedSettings?.public_profile_slug) {
          setSlugError('This slug is already taken.');
        }
      } catch (error) {
        // Don't show availability errors, just format errors
        console.error('Error checking slug availability:', error);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, extendedSettings?.public_profile_slug]);

  // Track changes
  useEffect(() => {
    if (extendedSettings) {
      const enabledChanged = enabled !== (extendedSettings.public_profile_enabled ?? false);
      const slugChanged = slug !== (extendedSettings.public_profile_slug ?? '');
      setHasChanges(enabledChanged || slugChanged);
    }
  }, [enabled, slug, extendedSettings]);

  const handleToggleEnabled = useCallback((value: boolean) => {
    setEnabled(value);
  }, []);

  const handleSlugChange = useCallback((value: string) => {
    // Convert to lowercase and remove invalid characters
    const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleanSlug);
  }, []);

  const handleSave = useCallback(async () => {
    if (slugError || isCheckingSlug) return;

    // If enabling, require a slug
    if (enabled && !slug) {
      setSlugError('A slug is required to enable your public profile.');
      return;
    }

    updateSettings.mutate({
      enabled,
      slug: slug || undefined,
    });
  }, [enabled, slug, slugError, isCheckingSlug, updateSettings]);

  const handleCopyLink = useCallback(async () => {
    if (!slug) return;

    const url = getPublicProfileBaseUrl() + slug;
    const success = await copyToClipboard(url);
    if (success) {
      if (Platform.OS === 'web') {
        alert('Link copied to clipboard.');
      } else {
        Alert.alert('Copied', 'Link copied to clipboard.');
      }
    } else {
      if (Platform.OS === 'web') {
        alert('Failed to copy link.');
      } else {
        Alert.alert('Error', 'Failed to copy link.');
      }
    }
  }, [slug]);

  const previewUrl = slug ? getPublicProfileBaseUrl() + slug : null;
  const isSlugValid = slug && isValidSlug(slug) && !slugError;
  const canSave = hasChanges && !slugError && !isCheckingSlug && !updateSettings.isPending;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={{ color: colors.text }}>
          Public Profile
        </Text>
        <Text variant="body" style={{ color: colors.textSecondary, marginTop: spacing.xs }}>
          Share your stats publicly with a unique profile link.
        </Text>
      </View>

      {/* Enable Toggle */}
      <Card style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Icon name="share" size={20} color={colors.primary} />
            <Text variant="body" style={{ color: colors.text, marginLeft: spacing.sm }}>
              Enable Public Profile
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggleEnabled}
            disabled={disabled || updateSettings.isPending}
            trackColor={{ false: colors.surfaceVariant, true: colors.primary + '60' }}
            thumbColor={enabled ? colors.primary : colors.textMuted}
          />
        </View>
        {enabled && (
          <Text variant="caption" style={{ color: colors.textMuted, marginTop: spacing.sm }}>
            Your profile will be visible to anyone with the link.
          </Text>
        )}
      </Card>

      {/* Slug Input */}
      <View style={styles.slugSection}>
        <Text variant="label" style={{ color: colors.text, marginBottom: spacing.xs }}>
          Profile URL
        </Text>
        <View style={styles.slugInputContainer}>
          <Text variant="body" style={{ color: colors.textMuted }}>
            {getPublicProfileBaseUrl()}
          </Text>
          <TextInput
            value={slug}
            onChangeText={handleSlugChange}
            placeholder="your-slug"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled && !updateSettings.isPending}
            style={[
              styles.slugInput,
              {
                color: colors.text,
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.sm,
              },
            ]}
          />
          {isCheckingSlug && <Spinner size="small" />}
        </View>
        {slugError && (
          <Text variant="caption" style={{ color: colors.error, marginTop: spacing.xs }}>
            {slugError}
          </Text>
        )}
        {isSlugValid && !isCheckingSlug && (
          <Text variant="caption" style={{ color: colors.success, marginTop: spacing.xs }}>
            This slug is available.
          </Text>
        )}
      </View>

      {/* Preview Link */}
      {previewUrl && isSlugValid && (
        <Card style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Icon name="share-2" size={16} color={colors.primary} />
            <Text variant="label" style={{ color: colors.text, marginLeft: spacing.xs }}>
              Your Profile Link
            </Text>
          </View>
          <View style={styles.previewUrlRow}>
            <Text
              variant="body"
              style={{ color: colors.primary, flex: 1 }}
              numberOfLines={1}
              selectable
            >
              {previewUrl}
            </Text>
            <Pressable
              style={[
                styles.copyButton,
                { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.sm },
              ]}
              onPress={handleCopyLink}
              accessibilityRole="button"
              accessibilityLabel="Copy profile link"
            >
              <Icon name="copy" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </Card>
      )}

      {/* Save Button */}
      <Button
        onPress={handleSave}
        disabled={!canSave || disabled}
        style={{ marginTop: spacing.lg }}
      >
        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
      </Button>

      {/* Current Status */}
      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: extendedSettings?.public_profile_enabled
                  ? colors.success
                  : colors.textMuted,
              },
            ]}
          />
          <Text variant="caption" style={{ color: colors.textSecondary }}>
            Profile is currently {extendedSettings?.public_profile_enabled ? 'enabled' : 'disabled'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  toggleCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slugSection: {
    marginBottom: spacing.lg,
  },
  slugInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  slugInput: {
    flex: 1,
    minWidth: 120,
    padding: spacing.sm,
  },
  previewCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copyButton: {
    padding: spacing.sm,
  },
  statusSection: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default PublicProfileSettings;
