/**
 * Navigation Type Definitions
 *
 * This module defines the typed navigation parameters for the entire app.
 * Using typed navigation provides compile-time safety for screen names and params.
 *
 * USAGE:
 * ```typescript
 * import { RootStackParamList, MainTabParamList } from '@/navigation/types';
 * import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
 *
 * type TimerScreenProps = {
 *   navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
 * };
 * ```
 *
 * @see https://reactnavigation.org/docs/typescript/
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Root Stack Navigator Parameter List
 *
 * The root navigator handles auth-based routing:
 * - Login: Shown when user is not authenticated
 * - Main: Tab navigator shown when user is authenticated
 * - EntryEdit: Modal for editing time entries (can be accessed from any tab)
 */
export type RootStackParamList = {
  /** Login screen - no parameters needed */
  Login: undefined;

  /** Setup screen - forced settings configuration for new users */
  Setup: undefined;

  /** Main tab navigator - nested navigator params */
  Main: NavigatorScreenParams<MainTabParamList> | undefined;

  /** Entry edit modal - requires entryId */
  EntryEdit: {
    entryId: string;
  };

  /** Focus mode - fullscreen distraction-free timer view */
  FocusMode: undefined;
};

/**
 * Main Tab Navigator Parameter List
 *
 * The bottom tab navigator with all main app screens:
 * - Hub: Dashboard home with widget grid
 * - Timer: Main timer interface
 * - History: Time entry history with filters
 * - Analytics: Dashboard with charts and stats
 * - Categories: Category management
 * - Goals: Monthly goal setting
 * - Settings: User preferences
 */
export type MainTabParamList = {
  /** Hub screen - dashboard home with widgets */
  Hub: undefined;

  /** Timer screen - no parameters needed */
  Timer: undefined;

  /** History screen - optional filter parameters */
  History:
    | {
        /** Initial category filter */
        categoryId?: string;
        /** Initial date range start (ISO 8601) */
        dateStart?: string;
        /** Initial date range end (ISO 8601) */
        dateEnd?: string;
      }
    | undefined;

  /** Analytics dashboard - no parameters needed */
  Analytics: undefined;

  /** Categories management - no parameters needed */
  Categories: undefined;

  /** Goals management - optional month parameter */
  Goals:
    | {
        /** Initial month to display (YYYY-MM-DD) */
        month?: string;
      }
    | undefined;

  /** Settings screen - no parameters needed */
  Settings: undefined;
};

/**
 * Type helper for getting navigation prop type for a specific screen
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> = {
  navigation: import('@react-navigation/native-stack').NativeStackNavigationProp<
    RootStackParamList,
    T
  >;
  route: import('@react-navigation/native').RouteProp<RootStackParamList, T>;
};

/**
 * Type helper for getting navigation prop type for a tab screen
 */
export type MainTabScreenProps<T extends keyof MainTabParamList> = {
  navigation: import('@react-navigation/bottom-tabs').BottomTabNavigationProp<MainTabParamList, T>;
  route: import('@react-navigation/native').RouteProp<MainTabParamList, T>;
};

/**
 * Declare global navigation types for useNavigation hook
 *
 * This allows useNavigation() to be properly typed without explicit generics:
 * ```typescript
 * const navigation = useNavigation(); // Automatically typed
 * navigation.navigate('Timer'); // Type-safe
 * ```
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
