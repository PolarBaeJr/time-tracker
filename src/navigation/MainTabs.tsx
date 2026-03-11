/**
 * Main Tab Navigator
 *
 * Bottom tab navigator with themed tab bar and icons.
 * Provides navigation between the main app screens:
 * - Hub: Dashboard home with widget grid (default landing screen)
 * - Timer: Main timer interface
 * - History: Time entry history
 * - Analytics: Dashboard with charts
 * - Categories: Category management
 * - Goals: Monthly goals
 * - Settings: User preferences
 */

import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Icon, type IconName } from '@/components/ui';
import { KeyboardShortcutProvider } from '@/components/KeyboardShortcutProvider';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';
import {
  HubScreen as HubScreenComponent,
  TimerScreen as TimerScreenComponent,
  HistoryScreen as HistoryScreenComponent,
  AnalyticsScreen as AnalyticsScreenComponent,
  CategoriesScreen as CategoriesScreenComponent,
  GoalsScreen as GoalsScreenComponent,
  SettingsScreen as SettingsScreenComponent,
} from '@/screens';

import type { MainTabParamList } from './types';

// ============================================================================
// Tab Navigator Configuration
// ============================================================================

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Get icon name based on route and focus state
 */
function getTabIcon(routeName: keyof MainTabParamList, focused: boolean): IconName {
  const iconMap: Record<keyof MainTabParamList, { active: IconName; inactive: IconName }> = {
    Hub: { active: 'home', inactive: 'home-outline' },
    Timer: { active: 'time', inactive: 'time-outline' },
    History: { active: 'list', inactive: 'list-outline' },
    Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline' },
    Categories: { active: 'folder', inactive: 'folder-outline' },
    Goals: { active: 'flag', inactive: 'flag-outline' },
    Settings: { active: 'settings', inactive: 'settings-outline' },
  };

  return focused ? iconMap[routeName].active : iconMap[routeName].inactive;
}

/**
 * Main Tabs Component
 *
 * Renders a bottom tab navigator with all main app screens.
 * Uses themed colors and custom Icon component for tab icons.
 */
export function MainTabs(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <KeyboardShortcutProvider>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: spacing.xs,
            height: 60,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginBottom: spacing.xs,
          },
          tabBarIcon: ({ focused, size }) => (
            <Icon
              name={getTabIcon(route.name, focused)}
              size={size}
              color={focused ? colors.primary : colors.textMuted}
            />
          ),
        })}
        initialRouteName="Hub"
      >
        <Tab.Screen name="Hub" component={HubScreenComponent} options={{ title: 'Hub' }} />
        <Tab.Screen name="Timer" component={TimerScreenComponent} options={{ title: 'Timer' }} />
        <Tab.Screen
          name="History"
          component={HistoryScreenComponent}
          options={{ title: 'History' }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreenComponent}
          options={{ title: 'Analytics' }}
        />
        <Tab.Screen
          name="Categories"
          component={CategoriesScreenComponent}
          options={{ title: 'Categories', headerShown: false }}
        />
        <Tab.Screen name="Goals" component={GoalsScreenComponent} options={{ title: 'Goals' }} />
        <Tab.Screen
          name="Settings"
          component={SettingsScreenComponent}
          options={{ title: 'Settings', headerShown: false }}
        />
      </Tab.Navigator>
    </KeyboardShortcutProvider>
  );
}

export default MainTabs;
