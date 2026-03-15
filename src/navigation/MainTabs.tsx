/**
 * Main Tab Navigator
 *
 * Bottom tab navigator with themed tab bar and icons.
 * Optimized for mobile UX with 6 primary tabs:
 * - Hub: Dashboard home with widget grid (default landing screen)
 * - Timer: Main timer interface
 * - History: Time entry history
 * - Notes: Notes and todos management
 * - Analytics: Dashboard with charts
 * - Settings: User preferences, categories, and goals
 *
 * Features:
 * - Scale bounce animation on tab select (scale to 1.2, spring back to 1.0)
 * - Active indicator bar animation (animated width and opacity)
 * - Respects reduced motion preferences from UX Settings Store
 * - Respects animationsEnabled setting from UX Settings Store
 *
 * Categories and Goals are now accessible as stack screens from Settings
 * to reduce bottom bar clutter while maintaining quick access to core features.
 */

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Icon, type IconName } from '@/components/ui';
import { KeyboardShortcutProvider } from '@/components/KeyboardShortcutProvider';
import { useTheme } from '@/theme';
import { spacing, borderRadius } from '@/theme';
import { spring, getReducedMotionPreference, ANIMATION_DURATION } from '@/lib/animations';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import {
  HubScreen as HubScreenComponent,
  TimerScreen as TimerScreenComponent,
  HistoryScreen as HistoryScreenComponent,
  NotesScreen as NotesScreenComponent,
  AnalyticsScreen as AnalyticsScreenComponent,
  ProjectsScreen as ProjectsScreenComponent,
  SettingsScreen as SettingsScreenComponent,
} from '@/screens';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

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
    Notes: { active: 'file-text', inactive: 'file-text-outline' },
    Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline' },
    Projects: { active: 'briefcase', inactive: 'briefcase-outline' },
    Settings: { active: 'settings', inactive: 'settings-outline' },
  };

  return focused ? iconMap[routeName].active : iconMap[routeName].inactive;
}

// ============================================================================
// Animated Tab Icon Component
// ============================================================================

interface AnimatedTabIconProps {
  routeName: keyof MainTabParamList;
  focused: boolean;
  size: number;
  activeColor: string;
  inactiveColor: string;
  animationsEnabled: boolean;
}

/**
 * Animated tab icon with scale bounce on select
 */
function AnimatedTabIcon({
  routeName,
  focused,
  size,
  activeColor,
  inactiveColor,
  animationsEnabled,
}: AnimatedTabIconProps): React.ReactElement {
  // Animation value - use useState with lazy initializer for React Compiler compatibility
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [indicatorAnim] = useState(() => new Animated.Value(0));

  // Track previous focused state to detect changes
  const prevFocusedRef = useRef(focused);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Should we animate? Check both global animations setting and reduced motion
  const shouldAnimate = animationsEnabled && !getReducedMotionPreference();

  // Handle focus change animation
  useEffect(() => {
    // Only animate when focus changes from false to true
    if (focused && !prevFocusedRef.current && shouldAnimate) {
      // Stop any running animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      // Scale bounce animation: scale to 1.2, then spring back to 1.0
      scaleAnim.setValue(1);
      const scaleUp = Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: ANIMATION_DURATION.fast,
        useNativeDriver: true,
      });

      const scaleDown = spring(scaleAnim, 1, {
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      });

      const bounceAnimation = Animated.sequence([scaleUp, scaleDown]);
      animationRef.current = bounceAnimation;
      bounceAnimation.start(() => {
        animationRef.current = null;
      });
    }

    // Animate indicator bar
    if (shouldAnimate) {
      Animated.timing(indicatorAnim, {
        toValue: focused ? 1 : 0,
        duration: ANIMATION_DURATION.fast,
        useNativeDriver: false, // Can't use native driver for width
      }).start();
    } else {
      indicatorAnim.setValue(focused ? 1 : 0);
    }

    prevFocusedRef.current = focused;
  }, [focused, scaleAnim, indicatorAnim, shouldAnimate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  const iconName = getTabIcon(routeName, focused);
  const color = focused ? activeColor : inactiveColor;

  // Interpolate indicator width
  const indicatorWidth = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const indicatorOpacity = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon name={iconName} size={size} color={color} />
      </Animated.View>
      {/* Active indicator bar */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: activeColor,
            width: indicatorWidth,
            opacity: indicatorOpacity,
          },
        ]}
      />
    </View>
  );
}

// ============================================================================
// Tab Icon Wrapper
// ============================================================================

/**
 * Create a memoized tab icon component for a specific route
 */
const createTabIconComponent = (routeName: keyof MainTabParamList) => {
  const TabIconComponent = React.memo(function TabIconComponent({
    focused,
    size,
    color: _color,
  }: {
    focused: boolean;
    size: number;
    color: string;
  }) {
    const { colors } = useTheme();
    // Get animations enabled setting from UX store
    const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);

    return (
      <AnimatedTabIcon
        routeName={routeName}
        focused={focused}
        size={size}
        activeColor={colors.primary}
        inactiveColor={colors.textMuted}
        animationsEnabled={animationsEnabled}
      />
    );
  });
  TabIconComponent.displayName = `TabIcon_${routeName}`;
  return TabIconComponent;
};

// Create memoized tab icon components for each route
const HubTabIcon = createTabIconComponent('Hub');
const TimerTabIcon = createTabIconComponent('Timer');
const HistoryTabIcon = createTabIconComponent('History');
const NotesTabIcon = createTabIconComponent('Notes');
const AnalyticsTabIcon = createTabIconComponent('Analytics');
const ProjectsTabIcon = createTabIconComponent('Projects');
const SettingsTabIcon = createTabIconComponent('Settings');

// Map route names to tab icon render functions
const tabIconComponents: Record<
  keyof MainTabParamList,
  (props: { focused: boolean; size: number; color: string }) => React.ReactNode
> = {
  Hub: props => <HubTabIcon {...props} />,
  Timer: props => <TimerTabIcon {...props} />,
  History: props => <HistoryTabIcon {...props} />,
  Notes: props => <NotesTabIcon {...props} />,
  Analytics: props => <AnalyticsTabIcon {...props} />,
  Projects: props => <ProjectsTabIcon {...props} />,
  Settings: props => <SettingsTabIcon {...props} />,
};

/**
 * Main Tabs Component
 *
 * Renders a bottom tab navigator with all main app screens.
 * Uses themed colors and custom Icon component for tab icons.
 * Includes animated tab icons with scale bounce and active indicator.
 *
 * The Projects tab is conditionally shown when a workspace is active.
 */
export function MainTabs(): React.ReactElement {
  const { colors } = useTheme();
  const { activeWorkspace } = useWorkspaceContext();

  // Determine if workspace collaboration tabs should be shown
  const showWorkspaceTabs = activeWorkspace !== null;

  // Get tab bar icon for a specific route
  const getTabBarIcon = useCallback((routeName: keyof MainTabParamList) => {
    const IconComponent = tabIconComponents[routeName];
    return IconComponent;
  }, []);

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
          tabBarIcon: getTabBarIcon(route.name),
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
        <Tab.Screen name="Notes" component={NotesScreenComponent} options={{ title: 'Notes' }} />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreenComponent}
          options={{ title: 'Analytics' }}
        />
        {showWorkspaceTabs && (
          <Tab.Screen
            name="Projects"
            component={ProjectsScreenComponent}
            options={{ title: 'Projects' }}
          />
        )}
        <Tab.Screen
          name="Settings"
          component={SettingsScreenComponent}
          options={{ title: 'Settings', headerShown: false }}
        />
      </Tab.Navigator>
    </KeyboardShortcutProvider>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    height: 3,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs / 2,
  },
});

export default MainTabs;
