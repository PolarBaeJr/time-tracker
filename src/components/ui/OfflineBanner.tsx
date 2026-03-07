/**
 * OfflineBanner component
 *
 * Displays a banner when the device is offline and shows syncing status
 * when reconnected with queued items.
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useNetworkStatus, useOfflineSync } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';

export interface OfflineBannerProps {
  /** Whether to show syncing status when coming back online */
  showSyncStatus?: boolean;
}

export function OfflineBanner({
  showSyncStatus = true,
}: OfflineBannerProps): React.ReactElement | null {
  const { isOnline } = useNetworkStatus();
  const { isSyncing, queuedCount } = useOfflineSync({ autoSyncOnReconnect: true });
  const { colors } = useTheme();

  // Show syncing banner when back online with queued items
  if (isOnline && showSyncStatus && isSyncing) {
    return (
      <View style={[styles.banner, { backgroundColor: colors.primary }]}>
        <Text variant="caption" style={styles.text}>
          Syncing {queuedCount} pending {queuedCount === 1 ? 'change' : 'changes'}...
        </Text>
      </View>
    );
  }

  // Show offline banner
  if (!isOnline) {
    return (
      <View style={[styles.banner, { backgroundColor: colors.warning }]}>
        <Text variant="caption" style={styles.text}>
          {"You're offline. Changes will sync when you reconnect."}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
