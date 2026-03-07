/**
 * SpotifySettings
 *
 * Settings component for Spotify integration.
 * Allows connecting/disconnecting Spotify account.
 */

import * as React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui';
import { useSpotifyConnection, useConnectSpotify, useDisconnectSpotify } from '@/hooks/useSpotify';
import { useTheme } from '@/theme';

const SPOTIFY_GREEN = '#1DB954';

export interface SpotifySettingsProps {
  disabled?: boolean;
}

export function SpotifySettings({ disabled = false }: SpotifySettingsProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();
  const { data: connection, isConnected, isLoading } = useSpotifyConnection();
  const connectMutation = useConnectSpotify();
  const disconnectMutation = useDisconnectSpotify();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  if (isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={{ fontSize: fontSizes.md, color: colors.text, fontWeight: '500' }}>
              Spotify Connected
            </Text>
            {connection?.spotify_user_id && (
              <Text style={{ fontSize: fontSizes.sm, color: colors.textSecondary }}>
                {connection.spotify_user_id}
              </Text>
            )}
          </View>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
            onPress={() => disconnectMutation.mutate()}
            disabled={disabled || disconnectMutation.isPending}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: fontSizes.sm, color: colors.error, fontWeight: '500' }}>
              Disconnect
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.connectButton,
          {
            backgroundColor: SPOTIFY_GREEN,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
        onPress={() => connectMutation.mutate()}
        disabled={disabled || connectMutation.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.connectButtonText}>
          {connectMutation.isPending ? 'Connecting...' : 'Connect Spotify'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  button: {},
  connectButton: {
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SpotifySettings;
