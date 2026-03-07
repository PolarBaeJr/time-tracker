/**
 * Root Navigator
 *
 * Handles top-level navigation with authentication-based routing:
 * - Shows LoginScreen when user is not authenticated
 * - Shows MainTabs when user is authenticated
 * - Provides EntryEdit modal accessible from any screen
 */

import * as React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Text } from '@/components/ui';
import { EntryEditModal } from '@/components/history';
import { useAuth, useCategories } from '@/hooks';
import { LoginScreen, SetupScreen } from '@/screens';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { TimeEntrySchema } from '@/schemas';
import { colors, spacing } from '@/theme';

import { MainTabs } from './MainTabs';
import type { RootStackParamList, RootStackScreenProps } from './types';

/**
 * EntryEdit screen
 *
 * Fetches a single time entry by ID from route params and renders
 * the EntryEditModal as a full-screen modal.
 */
function EntryEditScreen({
  route,
  navigation,
}: RootStackScreenProps<'EntryEdit'>): React.ReactElement {
  const { entryId } = route.params;

  // Fetch the single time entry by ID
  const {
    data: entry,
    isLoading: entryLoading,
    error: entryError,
  } = useQuery({
    queryKey: queryKeys.timeEntry(entryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error) throw new Error(error.message);
      return TimeEntrySchema.parse(data);
    },
  });

  // Fetch categories for the category picker
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const handleClose = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Loading state
  if (entryLoading || categoriesLoading) {
    return (
      <View style={styles.placeholderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          Loading entry...
        </Text>
      </View>
    );
  }

  // Error state
  if (entryError || !entry) {
    return (
      <View style={styles.placeholderContainer}>
        <Text variant="heading" center>
          Entry not found
        </Text>
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          {entryError?.message || 'The entry could not be loaded.'}
        </Text>
      </View>
    );
  }

  return (
    <EntryEditModal
      entry={entry}
      categories={categories}
      visible={true}
      onClose={handleClose}
      onSaveSuccess={handleClose}
      onDeleteSuccess={handleClose}
    />
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 *
 * Conditionally renders:
 * - Login screen when not authenticated
 * - Main tab navigator when authenticated
 * - EntryEdit modal (presented over both states)
 */
export function RootNavigator(): React.ReactElement {
  const { isAuthenticated, user } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'fade',
      }}
    >
      {!isAuthenticated ? (
        // Unauthenticated stack
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      ) : !user?.onboarding_complete ? (
        // Onboarding: force settings setup before accessing the app
        <Stack.Screen name="Setup" component={SetupScreen} />
      ) : (
        // Authenticated stack
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="EntryEdit"
            component={EntryEditScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Edit Entry',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  placeholderSubtext: {
    marginTop: spacing.sm,
  },
});

export default RootNavigator;
