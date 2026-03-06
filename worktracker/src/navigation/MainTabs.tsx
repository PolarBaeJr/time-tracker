/**
 * Main Tab Navigator
 *
 * Bottom tab navigator with themed tab bar and icons.
 * Provides navigation between the main app screens:
 * - Timer: Main timer interface
 * - History: Time entry history
 * - Analytics: Dashboard with charts
 * - Categories: Category management
 * - Goals: Monthly goals
 * - Settings: User preferences
 */

import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Icon, Text, type IconName } from '@/components/ui';
import { colors, spacing } from '@/theme';

import type { MainTabParamList } from './types';

// ============================================================================
// Placeholder Screen Components
// These will be replaced with actual screens as they are implemented
// ============================================================================

function PlaceholderScreen({
  title,
  icon,
}: {
  title: string;
  icon: IconName;
}): React.ReactElement {
  return (
    <View style={styles.placeholderContainer}>
      <Icon name={icon} size={48} color={colors.primary} />
      <Text variant="heading" center style={styles.placeholderTitle}>
        {title}
      </Text>
      <Text variant="body" color="muted" center>
        Coming soon...
      </Text>
    </View>
  );
}

// Placeholder screens for each tab
// TODO: Replace with actual screen components as tasks are completed

function TimerScreen(): React.ReactElement {
  return <PlaceholderScreen title="Timer" icon="time-outline" />;
}

function HistoryScreen(): React.ReactElement {
  return <PlaceholderScreen title="History" icon="list-outline" />;
}

function AnalyticsScreen(): React.ReactElement {
  return <PlaceholderScreen title="Analytics" icon="bar-chart-outline" />;
}

function CategoriesScreen(): React.ReactElement {
  return <PlaceholderScreen title="Categories" icon="folder-outline" />;
}

function GoalsScreen(): React.ReactElement {
  return <PlaceholderScreen title="Goals" icon="flag-outline" />;
}

function SettingsScreen(): React.ReactElement {
  return <PlaceholderScreen title="Settings" icon="settings-outline" />;
}

// ============================================================================
// Tab Navigator Configuration
// ============================================================================

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Tab bar icon component
 */
function TabBarIcon({
  name,
  focused,
  size,
}: {
  name: IconName;
  focused: boolean;
  size: number;
}): React.ReactElement {
  return (
    <Icon
      name={name}
      size={size}
      color={focused ? colors.primary : colors.textMuted}
    />
  );
}

/**
 * Get icon name based on route and focus state
 */
function getTabIcon(routeName: keyof MainTabParamList, focused: boolean): IconName {
  const iconMap: Record<keyof MainTabParamList, { active: IconName; inactive: IconName }> = {
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
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
          <TabBarIcon
            name={getTabIcon(route.name, focused)}
            focused={focused}
            size={size}
          />
        ),
      })}
      initialRouteName="Timer"
    >
      <Tab.Screen
        name="Timer"
        component={TimerScreen}
        options={{ title: 'Timer' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: 'Categories' }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{ title: 'Goals' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  placeholderTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});

export default MainTabs;
