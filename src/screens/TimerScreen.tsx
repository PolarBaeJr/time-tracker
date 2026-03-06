/**
 * TimerScreen
 *
 * Main timer interface for tracking work time.
 * Displays timer, controls, and category selector.
 * Integrates with useRealtimeTimer for live updates across devices.
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="Timer" component={TimerScreen} />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TimerDisplay,
  TimerControls,
  CategorySelector,
} from '@/components/timer';
import { Button, Card, Text, Icon } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeTimer, useCategories, markLocalTimerAction } from '@/hooks';
import { startTimer, stopTimer } from '@/services/timerService';
import { useTimerStore } from '@/stores';
import { colors, spacing, borderRadius } from '@/theme';
import { queryKeys } from '@/lib/queryClient';
import type { Category } from '@/schemas';

/**
 * Connection status indicator component
 */
function ConnectionIndicator({
  status,
}: {
  status: 'connected' | 'reconnecting' | 'disconnected';
}): React.ReactElement {
  const statusColors = {
    connected: colors.success,
    reconnecting: colors.warning,
    disconnected: colors.error,
  };

  const statusLabels = {
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    disconnected: 'Offline',
  };

  return (
    <View style={styles.connectionIndicator}>
      <View
        style={[
          styles.connectionDot,
          { backgroundColor: statusColors[status] },
        ]}
      />
      <Text variant="caption" color="muted">
        {statusLabels[status]}
      </Text>
    </View>
  );
}

/**
 * Selected category display component
 */
function SelectedCategoryDisplay({
  category,
  onPress,
}: {
  category: Category | null;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={onPress}
      style={styles.categoryButton}
    >
      <View style={styles.categoryButtonContent}>
        {category ? (
          <>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: category.color },
              ]}
            />
            <Text variant="body">{category.name}</Text>
            <Text variant="caption" color="muted" style={styles.categoryType}>
              {category.type}
            </Text>
          </>
        ) : (
          <>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: colors.textMuted },
              ]}
            />
            <Text variant="body" color="muted">
              No category
            </Text>
          </>
        )}
        <Icon
          name="chevron-down"
          size={16}
          color={colors.textMuted}
          style={styles.chevron}
        />
      </View>
    </Button>
  );
}

/**
 * TimerScreen Component
 *
 * Main screen for timer functionality with:
 * - Large time display (HH:MM:SS)
 * - Start/Stop controls
 * - Category selection
 * - Quick notes input when stopping
 * - Connection status indicator
 * - Responsive layout for phone and tablet
 */
export function TimerScreen(): React.ReactElement {
  const queryClient = useQueryClient();

  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [stopNotes, setStopNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);

  // Timer store state
  const activeTimer = useTimerStore((state) => state.activeTimer);

  // Realtime timer subscription
  const {
    connectionStatus,
    lastSyncMessage,
    clearSyncMessage,
  } = useRealtimeTimer({
    onTimerChange: (message) => {
      // Show platform-appropriate notification
      if (Platform.OS !== 'web') {
        Alert.alert('Timer Sync', message);
      }
      // On web, the sync message toast displays instead
    },
  });

  // Clear sync message after display
  React.useEffect(() => {
    if (lastSyncMessage) {
      const timer = setTimeout(clearSyncMessage, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncMessage, clearSyncMessage]);

  // Fetch categories for display
  const { data: categories = [] } = useCategories();

  // Get the selected category object
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find((c) => c.id === selectedCategoryId) ?? null;
  }, [selectedCategoryId, categories]);

  // Get the active timer's category
  const activeTimerCategory = useMemo(() => {
    if (!activeTimer?.category_id) return null;
    return categories.find((c) => c.id === activeTimer.category_id) ?? null;
  }, [activeTimer, categories]);

  // Handle start timer
  const handleStart = useCallback(async () => {
    setIsStarting(true);
    markLocalTimerAction();

    try {
      const result = await startTimer({ categoryId: selectedCategoryId });

      if (result.error) {
        const message = result.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to start timer: ${message}`);
        } else {
          Alert.alert('Error', `Failed to start timer: ${message}`);
        }
      }
      // Success - timer store will be updated by realtime subscription
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      if (Platform.OS === 'web') {
        alert(`Failed to start timer: ${message}`);
      } else {
        Alert.alert('Error', `Failed to start timer: ${message}`);
      }
    } finally {
      setIsStarting(false);
    }
  }, [selectedCategoryId]);

  // Handle stop timer
  const handleStop = useCallback(async () => {
    // If notes input isn't showing, show it first
    if (!showNotesInput) {
      setShowNotesInput(true);
      return;
    }

    setIsStopping(true);
    markLocalTimerAction();

    try {
      const result = await stopTimer({
        notes: stopNotes.trim() || null,
      });

      if (result.error) {
        const message = result.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to stop timer: ${message}`);
        } else {
          Alert.alert('Error', `Failed to stop timer: ${message}`);
        }
      } else {
        // Success - clear notes input and refresh history/analytics
        setStopNotes('');
        setShowNotesInput(false);
        void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      if (Platform.OS === 'web') {
        alert(`Failed to stop timer: ${message}`);
      } else {
        Alert.alert('Error', `Failed to stop timer: ${message}`);
      }
    } finally {
      setIsStopping(false);
    }
  }, [showNotesInput, stopNotes, queryClient]);

  // Handle quick stop (without notes)
  const handleQuickStop = useCallback(async () => {
    setIsStopping(true);
    markLocalTimerAction();

    try {
      const result = await stopTimer({ notes: null });

      if (result.error) {
        const message = result.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to stop timer: ${message}`);
        } else {
          Alert.alert('Error', `Failed to stop timer: ${message}`);
        }
      } else {
        setStopNotes('');
        setShowNotesInput(false);
        void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      if (Platform.OS === 'web') {
        alert(`Failed to stop timer: ${message}`);
      } else {
        Alert.alert('Error', `Failed to stop timer: ${message}`);
      }
    } finally {
      setIsStopping(false);
    }
  }, [queryClient]);

  // Cancel notes input
  const handleCancelNotes = useCallback(() => {
    setShowNotesInput(false);
    setStopNotes('');
  }, []);

  // Open category selector
  const handleOpenCategorySelector = useCallback(() => {
    setShowCategorySelector(true);
  }, []);

  // Close category selector
  const handleCloseCategorySelector = useCallback(() => {
    setShowCategorySelector(false);
  }, []);

  // Select category
  const handleSelectCategory = useCallback((categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const hasActiveTimer = activeTimer !== null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with connection status */}
          <View style={styles.header}>
            <Text variant="display" style={styles.headerTitle}>
              Timer
            </Text>
            <ConnectionIndicator status={connectionStatus} />
          </View>

          {/* Main timer card */}
          <Card style={styles.timerCard} padding="lg" elevation="md">
            {/* Timer display */}
            <TimerDisplay />

            {/* Category display */}
            <View style={styles.categorySection}>
              {hasActiveTimer ? (
                // Show active timer's category (read-only)
                <View style={styles.activeCategoryDisplay}>
                  {activeTimerCategory ? (
                    <>
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: activeTimerCategory.color },
                        ]}
                      />
                      <Text variant="body">{activeTimerCategory.name}</Text>
                      <Text
                        variant="caption"
                        color="muted"
                        style={styles.categoryType}
                      >
                        {activeTimerCategory.type}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: colors.textMuted },
                        ]}
                      />
                      <Text variant="body" color="muted">
                        No category
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                // Show category selector button
                <SelectedCategoryDisplay
                  category={selectedCategory}
                  onPress={handleOpenCategorySelector}
                />
              )}
            </View>

            {/* Quick notes input (shown when stopping) */}
            {showNotesInput && hasActiveTimer && (
              <View style={styles.notesSection}>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes (optional)..."
                  placeholderTextColor={colors.textMuted}
                  value={stopNotes}
                  onChangeText={setStopNotes}
                  multiline
                  maxLength={1000}
                  autoFocus
                />
                <View style={styles.notesActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={handleCancelNotes}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={handleQuickStop}
                    disabled={isStopping}
                  >
                    Skip Notes
                  </Button>
                </View>
              </View>
            )}

            {/* Timer controls */}
            <TimerControls
              onStart={handleStart}
              onStop={handleStop}
              isStarting={isStarting}
              isStopping={isStopping}
              style={styles.controls}
            />
          </Card>

          {/* Sync message toast */}
          {lastSyncMessage && (
            <Card style={styles.syncToast} padding="sm">
              <Text variant="bodySmall" center>
                {lastSyncMessage}
              </Text>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category selector modal */}
      <CategorySelector
        visible={showCategorySelector}
        onClose={handleCloseCategorySelector}
        onSelect={handleSelectCategory}
        selectedCategoryId={selectedCategoryId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
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
    paddingHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: 28,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryButton: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeCategoryDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryType: {
    marginLeft: spacing.xs,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  notesSection: {
    width: '100%',
    marginBottom: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.surfaceVariant,
    color: colors.text,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  controls: {
    marginTop: spacing.md,
    width: '100%',
  },
  syncToast: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceVariant,
  },
});

export default TimerScreen;
