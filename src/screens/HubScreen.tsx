/**
 * HubScreen
 *
 * Dashboard home screen with widget grid and personalized greeting.
 * Displays customizable widgets showing time tracking summary,
 * active timer status, and quick access to common actions.
 */

import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { WidgetGrid, TimerWidget, EmailWidget, CalendarWidget } from '@/components/hub';
import { Text, Icon, Button } from '@/components/ui';
import { useWidgetLayout, useAuth, useUserSettings } from '@/hooks';
import { useTheme, spacing } from '@/theme';
import { queryKeys } from '@/lib/queryClient';
import type { HubWidgetConfig } from '@/stores/hubStore';

/**
 * Get time-based greeting based on current hour
 */
function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'Good evening';
  }
  return 'Good night';
}

/**
 * HubScreen Component
 *
 * Main dashboard screen displaying:
 * - Personalized time-based greeting
 * - Edit mode toggle for customizing widgets
 * - Responsive widget grid with TimerWidget
 * - Pull-to-refresh for data updates
 */
export function HubScreen(): React.ReactElement {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // User settings for name
  const { settings: userSettings } = useUserSettings({
    userId: user?.id,
    enabled: !!user?.id,
  });

  // Widget layout state
  const { visibleWidgets, isEditMode, setEditMode } = useWidgetLayout();

  // Refreshing state
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Get user's first name or fallback
  const userName = useMemo(() => {
    if (userSettings?.name) {
      // Extract first name from display name
      const firstName = userSettings.name.split(' ')[0];
      return firstName;
    }
    return null;
  }, [userSettings?.name]);

  // Generate greeting with name
  const greeting = useMemo(() => {
    const baseGreeting = getGreeting();
    if (userName) {
      return `${baseGreeting}, ${userName}`;
    }
    return baseGreeting;
  }, [userName]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all widget-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: ['timeEntries'] }),
        // Calendar widget queries
        queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnections }),
        queryClient.invalidateQueries({ queryKey: queryKeys.todayEvents }),
        // Email widget queries
        queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recentEmails }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Toggle edit mode
  const handleToggleEditMode = useCallback(() => {
    setEditMode(!isEditMode);
  }, [isEditMode, setEditMode]);

  // Render widget based on type
  const renderWidget = useCallback((widget: HubWidgetConfig): React.ReactElement => {
    switch (widget.type) {
      case 'timer':
        return <TimerWidget key={widget.id} size={widget.size} />;
      case 'email':
        return <EmailWidget key={widget.id} size={widget.size} />;
      case 'calendar':
        return <CalendarWidget key={widget.id} size={widget.size} />;
      default:
        // Future widget types will be added here
        return (
          <View key={widget.id} style={styles.unknownWidget}>
            <Text color="muted">Unknown widget: {widget.type}</Text>
          </View>
        );
    }
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            <Text variant="heading" style={styles.greeting}>
              {greeting}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {/* Edit mode toggle */}
            <Pressable
              onPress={handleToggleEditMode}
              style={[
                styles.editButton,
                {
                  backgroundColor: isEditMode ? colors.primary : colors.surfaceVariant,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isEditMode ? 'Done editing' : 'Edit widgets'}
              accessibilityState={{ selected: isEditMode }}
            >
              <Icon
                name={isEditMode ? 'check' : 'edit'}
                size={18}
                color={isEditMode ? colors.text : colors.textSecondary}
              />
            </Pressable>

            {/* Add widget button (placeholder for future) */}
            {isEditMode && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  // Future: Open widget picker modal
                }}
                disabled
                style={styles.addButton}
              >
                <Icon name="add" size={20} color={colors.textMuted} />
              </Button>
            )}
          </View>
        </View>

        {/* Widget Grid */}
        {visibleWidgets.length > 0 ? (
          <WidgetGrid
            widgets={visibleWidgets}
            renderWidget={renderWidget}
            editMode={isEditMode}
            style={styles.widgetGrid}
          />
        ) : (
          <View style={styles.emptyState}>
            <Icon name="folder-outline" size={48} color={colors.textMuted} />
            <Text variant="body" color="muted" style={styles.emptyText}>
              No widgets visible
            </Text>
            <Button variant="outline" size="sm" onPress={handleToggleEditMode}>
              Customize
            </Button>
          </View>
        )}
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
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    // Using heading variant styling
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    paddingHorizontal: spacing.xs,
  },
  widgetGrid: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    marginTop: spacing.sm,
  },
  unknownWidget: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HubScreen;
