/**
 * PublicProfileSettingsScreen
 *
 * Screen for configuring public profile settings.
 * Displays the PublicProfileSettings component.
 */

import * as React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PublicProfileSettings } from '@/components/publicProfile';
import { useTheme, spacing } from '@/theme';

/**
 * PublicProfileSettingsScreen component
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="PublicProfileSettings" component={PublicProfileSettingsScreen} />
 * ```
 */
export function PublicProfileSettingsScreen(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PublicProfileSettings />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
});

export default PublicProfileSettingsScreen;
