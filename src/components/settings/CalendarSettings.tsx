/**
 * CalendarSettings
 *
 * Settings component for calendar integration (Google Calendar, Outlook Calendar).
 * Allows connecting/disconnecting calendar accounts, syncing events, and viewing status.
 * Web/Electron only - hidden on native platforms.
 */

import * as React from 'react';
import { View, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Text, Button, Icon } from '@/components/ui';
import {
  useCalendarConnections,
  useConnectGoogleCalendar,
  useConnectOutlookCalendar,
  useDisconnectCalendar,
  useSyncCalendar,
} from '@/hooks/useCalendar';
import { useTheme } from '@/theme';
import { getStoredOAuthError, getStoredOAuthSuccess } from '@/lib/oauth/callback';
import type { CalendarConnection, CalendarProvider } from '@/schemas/calendar';

// Provider colors
const GOOGLE_BLUE = '#4285F4';
const MICROSOFT_BLUE = '#0078D4';

// Provider display info - using 'clock' icon since 'calendar' is not available
const CALENDAR_PROVIDERS: { id: CalendarProvider; name: string; color: string; icon: 'clock' }[] = [
  { id: 'google', name: 'Google Calendar', color: GOOGLE_BLUE, icon: 'clock' },
  { id: 'outlook', name: 'Outlook Calendar', color: MICROSOFT_BLUE, icon: 'clock' },
];

export interface CalendarSettingsProps {
  disabled?: boolean;
}

/**
 * Formats a timestamp to a relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

/**
 * Individual calendar connection row component
 */
interface CalendarConnectionRowProps {
  connection: CalendarConnection;
  disabled?: boolean;
  onSync: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
  isSyncing: boolean;
  isDisconnecting: boolean;
}

function CalendarConnectionRow({
  connection,
  disabled = false,
  onSync,
  onDisconnect,
  isSyncing,
  isDisconnecting,
}: CalendarConnectionRowProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();
  const providerInfo = CALENDAR_PROVIDERS.find(p => p.id === connection.provider);

  const hasError = !!connection.sync_error;
  const statusColor = hasError ? colors.error : '#22C55E';

  return (
    <View
      style={[
        styles.connectionRow,
        {
          backgroundColor: colors.surfaceVariant,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      {/* Provider Icon and Info */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionHeader}>
          <View
            style={[
              styles.providerIconContainer,
              { backgroundColor: providerInfo?.color || colors.primary },
            ]}
          >
            <Icon name="clock" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.connectionDetails}>
            <Text style={{ fontSize: fontSizes.md, color: colors.text, fontWeight: '500' }}>
              {connection.email_address}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={{ fontSize: fontSizes.xs, color: colors.textSecondary }}>
                {providerInfo?.name || connection.provider} · Synced{' '}
                {formatRelativeTime(connection.last_sync_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Error Message */}
        {hasError && (
          <View style={[styles.errorContainer, { marginTop: spacing.sm }]}>
            <Icon name="alert" size={14} color={colors.error} />
            <Text
              style={{
                fontSize: fontSizes.xs,
                color: colors.error,
                marginLeft: spacing.xs,
                flex: 1,
              }}
              numberOfLines={2}
            >
              {connection.sync_error}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Sync Button */}
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
          onPress={() => onSync(connection.id)}
          disabled={disabled || isSyncing || isDisconnecting}
          accessibilityRole="button"
          accessibilityLabel="Sync calendar"
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Icon name="time" size={14} color={colors.primary} />
              <Text
                style={{
                  fontSize: fontSizes.xs,
                  color: colors.primary,
                  marginLeft: spacing.xs,
                  fontWeight: '500',
                }}
              >
                Sync
              </Text>
            </>
          )}
        </Pressable>

        {/* Disconnect Button */}
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
          onPress={() => onDisconnect(connection.id)}
          disabled={disabled || isSyncing || isDisconnecting}
          accessibilityRole="button"
          accessibilityLabel="Disconnect calendar"
        >
          {isDisconnecting ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Text style={{ fontSize: fontSizes.xs, color: colors.error, fontWeight: '500' }}>
              Disconnect
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Provider selection component for adding new calendars
 */
interface CalendarProviderSelectorProps {
  disabled?: boolean;
  onSelectGoogle: () => void;
  onSelectOutlook: () => void;
  isConnectingGoogle: boolean;
  isConnectingOutlook: boolean;
}

function CalendarProviderSelector({
  disabled = false,
  onSelectGoogle,
  onSelectOutlook,
  isConnectingGoogle,
  isConnectingOutlook,
}: CalendarProviderSelectorProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();
  const isConnecting = isConnectingGoogle || isConnectingOutlook;

  return (
    <View style={styles.providerSelector}>
      {/* Google Calendar */}
      <Pressable
        style={[
          styles.providerButton,
          {
            backgroundColor: GOOGLE_BLUE,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
        onPress={onSelectGoogle}
        disabled={disabled || isConnecting}
        accessibilityRole="button"
        accessibilityLabel="Connect Google Calendar"
      >
        <Icon name="clock" size={18} color="#FFFFFF" />
        <Text style={[styles.providerButtonText, { fontSize: fontSizes.sm }]}>
          {isConnectingGoogle ? 'Connecting...' : 'Google Calendar'}
        </Text>
      </Pressable>

      {/* Outlook Calendar */}
      <Pressable
        style={[
          styles.providerButton,
          {
            backgroundColor: MICROSOFT_BLUE,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
        onPress={onSelectOutlook}
        disabled={disabled || isConnecting}
        accessibilityRole="button"
        accessibilityLabel="Connect Outlook Calendar"
      >
        <Icon name="clock" size={18} color="#FFFFFF" />
        <Text style={[styles.providerButtonText, { fontSize: fontSizes.sm }]}>
          {isConnectingOutlook ? 'Connecting...' : 'Outlook Calendar'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Main CalendarSettings component (Web implementation)
 */
function CalendarSettingsWeb({ disabled = false }: CalendarSettingsProps): React.ReactElement {
  const { colors, spacing, fontSizes } = useTheme();

  // Hooks
  const { connections, hasConnections, isLoading } = useCalendarConnections();
  const connectGoogleMutation = useConnectGoogleCalendar();
  const connectOutlookMutation = useConnectOutlookCalendar();
  const disconnectMutation = useDisconnectCalendar();
  const syncMutation = useSyncCalendar();

  // Track which connection is being synced
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);

  // OAuth error and success states (displayed when OAuth callback returns)
  const [oauthError, setOauthError] = React.useState<string | null>(null);
  const [oauthSuccess, setOauthSuccess] = React.useState<string | null>(null);

  // Check for OAuth errors or success on mount (e.g., from OAuth callback redirect)
  React.useEffect(() => {
    // Check for stored error from callback
    const storedError = getStoredOAuthError();
    if (
      storedError &&
      (storedError.type === 'google_calendar' || storedError.type === 'outlook_calendar')
    ) {
      setOauthError(storedError.error);
      return;
    }

    // Check for stored success from callback
    const storedSuccess = getStoredOAuthSuccess();
    if (
      storedSuccess &&
      (storedSuccess.type === 'google_calendar' || storedSuccess.type === 'outlook_calendar')
    ) {
      setOauthSuccess(`Successfully connected ${storedSuccess.emailAddress}`);
      // Auto-dismiss success message after 5 seconds
      const timeout = setTimeout(() => setOauthSuccess(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, []);

  // Handlers
  const handleSync = React.useCallback(
    async (connectionId: string) => {
      setSyncingId(connectionId);
      try {
        await syncMutation.mutateAsync(connectionId);
      } catch {
        // Error is handled by the mutation
      } finally {
        setSyncingId(null);
      }
    },
    [syncMutation]
  );

  const handleDisconnect = React.useCallback(
    async (connectionId: string) => {
      setDisconnectingId(connectionId);
      try {
        await disconnectMutation.mutateAsync(connectionId);
      } catch {
        // Error is handled by the mutation
      } finally {
        setDisconnectingId(null);
      }
    },
    [disconnectMutation]
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: fontSizes.sm, color: colors.textMuted, marginLeft: spacing.sm }}>
            Loading calendar connections...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Success message from OAuth callback */}
      {oauthSuccess && (
        <View
          style={[
            styles.successBanner,
            {
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 8,
              padding: spacing.sm,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
            },
          ]}
        >
          <Icon name="checkmark-circle" size={16} color="#22C55E" />
          <Text
            style={{
              fontSize: fontSizes.sm,
              color: '#22C55E',
              marginLeft: spacing.xs,
              flex: 1,
            }}
          >
            {oauthSuccess}
          </Text>
          <Pressable
            onPress={() => setOauthSuccess(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Icon name="x" size={16} color="#22C55E" />
          </Pressable>
        </View>
      )}

      {/* Connected Calendars */}
      {hasConnections && (
        <View style={styles.section}>
          <Text
            style={{
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
              marginBottom: spacing.sm,
              fontWeight: '500',
            }}
          >
            Connected Calendars
          </Text>
          <View style={styles.connectionsList}>
            {connections.map(connection => (
              <CalendarConnectionRow
                key={connection.id}
                connection={connection}
                disabled={disabled}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                isSyncing={syncingId === connection.id}
                isDisconnecting={disconnectingId === connection.id}
              />
            ))}
          </View>
        </View>
      )}

      {/* Add Calendar Section */}
      <View style={styles.section}>
        <Text
          style={{
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
            fontWeight: '500',
          }}
        >
          {hasConnections ? 'Add Another Calendar' : 'Connect a Calendar'}
        </Text>
        <CalendarProviderSelector
          disabled={disabled}
          onSelectGoogle={() => {
            setOauthError(null);
            connectGoogleMutation.mutate();
          }}
          onSelectOutlook={() => {
            setOauthError(null);
            connectOutlookMutation.mutate();
          }}
          isConnectingGoogle={connectGoogleMutation.isPending}
          isConnectingOutlook={connectOutlookMutation.isPending}
        />
        {/* OAuth Error Display */}
        {oauthError && (
          <View
            style={[
              styles.oauthErrorContainer,
              {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 8,
                padding: spacing.sm,
                marginTop: spacing.sm,
              },
            ]}
          >
            <Icon name="alert" size={14} color={colors.error} />
            <Text
              style={{
                fontSize: fontSizes.xs,
                color: colors.error,
                marginLeft: spacing.xs,
                flex: 1,
              }}
            >
              {oauthError}
            </Text>
            <Pressable
              onPress={() => setOauthError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Icon name="x" size={14} color={colors.error} />
            </Pressable>
          </View>
        )}
        {!hasConnections && !oauthError && (
          <Text
            style={{
              fontSize: fontSizes.xs,
              color: colors.textMuted,
              marginTop: spacing.sm,
            }}
          >
            Connect your calendar to see events in the Hub widget and get AI-powered daily
            summaries.
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * CalendarSettings - Web/Electron only, returns null on native
 */
export function CalendarSettings(props: CalendarSettingsProps): React.ReactElement | null {
  if (Platform.OS !== 'web') return null;
  return <CalendarSettingsWeb {...props} />;
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  successBanner: {
    // Additional styles applied inline
  },
  section: {
    gap: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionsList: {
    gap: 8,
  },
  connectionRow: {
    flexDirection: 'column',
    gap: 8,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  connectionDetails: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 150,
    justifyContent: 'center',
  },
  providerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  oauthErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default CalendarSettings;
