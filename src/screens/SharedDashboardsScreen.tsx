/**
 * SharedDashboardsScreen
 *
 * Screen for managing shared dashboard links.
 * Displays the SharedDashboardManager component.
 */

import * as React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { SharedDashboardManager } from '@/components/sharedDashboards';
import { useTheme, spacing } from '@/theme';

/**
 * SharedDashboardsScreen component
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="SharedDashboards" component={SharedDashboardsScreen} />
 * ```
 */
export function SharedDashboardsScreen(): React.ReactElement {
  const { colors } = useTheme();

  const handleShareCreated = React.useCallback((shareUrl: string) => {
    // Optionally show a toast or alert that the share link was created
    // The SharedDashboardManager already shows the link and copy functionality
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <SharedDashboardManager onShareCreated={handleShareCreated} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SharedDashboardsScreen;
