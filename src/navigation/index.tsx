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
  DarkTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { RootNavigator } from './RootNavigator';

// Re-export navigation components
export { RootNavigator } from './RootNavigator';
export { MainTabs } from './MainTabs';

// Re-export types
export * from './types';

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
 */
/**
 * Handle auth callback deep links before React Navigation sees them.
 * Extracts the PKCE code and exchanges it for a session, then returns
 * null so navigation ignores the URL.
 */
function handleAuthCallback(url: string): boolean {
  if (!url.includes('/auth/callback')) return false;

  const queryString = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(queryString);
  const code = params.get('code');

  if (code) {
    void supabase.auth.exchangeCodeForSession(code);
  }

  return true;
}

const linking = {
  prefixes:
    Platform.OS === 'web' && typeof window !== 'undefined'
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
  // Intercept auth callbacks so they don't confuse React Navigation
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url && handleAuthCallback(url)) return null;
    return url;
  },
  subscribe(listener: (url: string) => void) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!handleAuthCallback(url)) {
        listener(url);
      }
    });
    return () => subscription.remove();
  },
};

export function NavigationProvider({ children }: NavigationProviderProps): React.ReactElement {
  const { colors, isDark } = useTheme();

  const navigationTheme: NavigationTheme = React.useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [colors, isDark]
  );

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      {children ?? <RootNavigator />}
    </NavigationContainer>
  );
}

export default NavigationProvider;
