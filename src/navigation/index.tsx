/**
 * Navigation Module
 *
 * Exports the main navigation components and types for the app.
 * Provides a NavigationContainer wrapper with theme integration.
 */

import * as React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { Platform } from 'react-native';

import { colors } from '@/theme';

import { RootNavigator } from './RootNavigator';

// Re-export navigation components
export { RootNavigator } from './RootNavigator';
export { MainTabs } from './MainTabs';

// Re-export types
export * from './types';

/**
 * Custom navigation theme matching the app's dark theme
 *
 * Maps app theme colors to React Navigation's theme structure
 * for consistent styling across all navigation components.
 */
export const navigationTheme: NavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

/**
 * Navigation Provider Props
 */
interface NavigationProviderProps {
  children?: React.ReactNode;
}

/**
 * Navigation Provider Component
 *
 * Wraps the app with NavigationContainer and applies the custom theme.
 * Should be used at the root of the app inside AuthProvider.
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <NavigationProvider />
 * </AuthProvider>
 * ```
 */
const linking = {
  prefixes: Platform.OS === 'web' && typeof window !== 'undefined'
    ? [window.location.origin]
    : ['worktracker://'],
  config: {
    screens: {
      Login: 'login',
      Setup: 'setup',
      Main: {
        path: '',
        screens: {
          Timer: 'timer',
          History: 'history',
          Analytics: 'analytics',
          Categories: 'categories',
          Settings: 'settings',
        },
      },
      EntryEdit: 'entry/:entryId',
    },
  },
};

export function NavigationProvider({
  children,
}: NavigationProviderProps): React.ReactElement {
  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      {children ?? <RootNavigator />}
    </NavigationContainer>
  );
}

export default NavigationProvider;
