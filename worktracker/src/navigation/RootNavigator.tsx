/**
 * Root Navigator
 *
 * Handles top-level navigation with authentication-based routing:
 * - Shows LoginScreen when user is not authenticated
 * - Shows MainTabs when user is authenticated
 * - Provides EntryEdit modal accessible from any screen
 */

import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { LoginScreen } from '@/screens';
import { colors, spacing } from '@/theme';

import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

/**
 * Placeholder EntryEdit screen
 * TODO: Replace with actual EntryEditScreen when task-027 is implemented
 */
function EntryEditScreen(): React.ReactElement {
  return (
    <View style={styles.placeholderContainer}>
      <Text variant="heading" center>
        Entry Edit Screen
      </Text>
      <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
        Coming soon...
      </Text>
    </View>
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
  const { isAuthenticated } = useAuth();

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
