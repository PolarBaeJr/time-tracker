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
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

import {
  TimerDisplay,
  TimerControls,
  PomodoroInfo,
  CategorySelector,
  SkipPhaseButton,
  TimerModeDropdown,
  QuickTimerPresets,
  type SessionSettings,
} from '@/components/timer';
import { Button, Card, Text, Icon } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRealtimeTimer,
  useCategories,
  markLocalTimerAction,
  usePomodoro,
  usePomodoroSettings,
  usePomodoroPresets,
  useKeyboardShortcuts,
  sendNotification,
  useTraySync,
} from '@/hooks';
import { useTimerSounds } from '@/hooks/useTimerSounds';
import { useIdleDetection } from '@/hooks/useIdleDetection';
import { startTimer, stopTimer, syncTimerWithStore } from '@/services/timerService';
import { useTimerStore, useTimerSettings } from '@/stores';
import { colors, spacing, borderRadius } from '@/theme';
import { queryKeys } from '@/lib/queryClient';
import type { Category } from '@/schemas';
import type { TimerMode } from '@/types';
import type { QuickPreset } from '@/stores/timerSettingsStore';

const PHASE_LABELS = {
  work: 'Focus Time',
  break: 'Short Break',
  long_break: 'Long Break',
} as const;

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
      <View style={[styles.connectionDot, { backgroundColor: statusColors[status] }]} />
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
    <Button variant="ghost" size="sm" onPress={onPress} style={styles.categoryButton}>
      <View style={styles.categoryButtonContent}>
        {category ? (
          <>
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
            <Text variant="body">{category.name}</Text>
            <Text variant="caption" color="muted" style={styles.categoryType}>
              {category.type}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.categoryDot, { backgroundColor: colors.textMuted }]} />
            <Text variant="body" color="muted">
              No category
            </Text>
          </>
        )}
        <Icon name="chevron-down" size={16} color={colors.textMuted} style={styles.chevron} />
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
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');

  // Timer sounds
  const { playSound } = useTimerSounds();

  // Idle detection settings
  const { idleDetectionEnabled, idleThresholdMinutes } = useTimerSettings();

  // Pomodoro settings (persisted)
  const { settings: pomodoroSettings, updateSettings: updatePomodoroSettings } =
    usePomodoroSettings();
  const {
    presets,
    savePreset: handleSavePreset,
    deletePreset: handleDeletePreset,
  } = usePomodoroPresets();

  // Session override settings (null = use defaults)
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);

  const effectiveSettings: SessionSettings = useMemo(
    () =>
      sessionSettings ?? {
        workDurationSeconds: pomodoroSettings.workDurationSeconds,
        breakDurationSeconds: pomodoroSettings.breakDurationSeconds,
        longBreakDurationSeconds: pomodoroSettings.longBreakDurationSeconds,
        pomodorosBeforeLongBreak: pomodoroSettings.pomodorosBeforeLongBreak,
      },
    [sessionSettings, pomodoroSettings]
  );

  const timerMode: TimerMode = pomodoroSettings.countdownEnabled
    ? 'countdown'
    : pomodoroSettings.pomodoroEnabled
      ? 'pomodoro'
      : 'normal';

  const handlePomodoroEnabledChange = useCallback(
    (enabled: boolean) => {
      updatePomodoroSettings({
        pomodoroEnabled: enabled,
        ...(enabled ? { countdownEnabled: false } : {}),
      });
    },
    [updatePomodoroSettings]
  );

  const handleCountdownEnabledChange = useCallback(
    (enabled: boolean) => {
      updatePomodoroSettings({
        countdownEnabled: enabled,
        ...(enabled ? { pomodoroEnabled: false } : {}),
      });
    },
    [updatePomodoroSettings]
  );

  const handleCountdownDurationChange = useCallback(
    (seconds: number) => {
      updatePomodoroSettings({ countdownDurationSeconds: seconds });
    },
    [updatePomodoroSettings]
  );

  const handleSessionSettingsChange = useCallback((settings: SessionSettings) => {
    setSessionSettings(settings);
  }, []);

  // Timer store state
  const activeTimer = useTimerStore(state => state.activeTimer);

  // Pomodoro state
  const pomodoro = usePomodoro();

  // Guard for auto-transition — track the timer ID we already transitioned from
  const isTransitioningRef = useRef(false);
  const lastTransitionedTimerIdRef = useRef<string | null>(null);

  // Sync timer with server on mount (crash recovery)
  useEffect(() => {
    void syncTimerWithStore().catch(err => {
      console.warn('[TimerScreen] Initial timer sync failed:', err);
    });
  }, []);

  // Realtime timer subscription
  const { connectionStatus, lastSyncMessage, clearSyncMessage } = useRealtimeTimer({
    onTimerChange: message => {
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
    return categories.find(c => c.id === selectedCategoryId) ?? null;
  }, [selectedCategoryId, categories]);

  // Get the active timer's category
  const activeTimerCategory = useMemo(() => {
    if (!activeTimer?.category_id) return null;
    return categories.find(c => c.id === activeTimer.category_id) ?? null;
  }, [activeTimer, categories]);

  // Next phase info for display
  const nextPhaseInfo = pomodoro.getNextPhaseInfo();

  // Handle start timer
  const handleStart = useCallback(async () => {
    setIsStarting(true);
    markLocalTimerAction();

    try {
      const options: Parameters<typeof startTimer>[0] = {
        categoryId: selectedCategoryId,
      };

      if (timerMode === 'pomodoro') {
        options.timerMode = 'pomodoro';
        options.pomodoroPhase = 'work';
        options.phaseDurationSeconds = effectiveSettings.workDurationSeconds;
        options.pomodorosCompleted = 0;
      } else if (timerMode === 'countdown') {
        options.timerMode = 'countdown';
        options.countdownDurationSeconds = pomodoroSettings.countdownDurationSeconds;
      }

      const result = await startTimer(options);

      if (result.error) {
        const message = result.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to start timer: ${message}`);
        } else {
          Alert.alert('Error', `Failed to start timer: ${message}`);
        }
      } else {
        playSound('start');
      }
      // Success - timer store will be updated by realtime subscription
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (Platform.OS === 'web') {
        alert(`Failed to start timer: ${message}`);
      } else {
        Alert.alert('Error', `Failed to start timer: ${message}`);
      }
    } finally {
      setIsStarting(false);
    }
  }, [
    selectedCategoryId,
    timerMode,
    effectiveSettings.workDurationSeconds,
    pomodoroSettings.countdownDurationSeconds,
    playSound,
  ]);

  // Handle stop timer
  const handleStop = useCallback(async () => {
    setIsStopping(true);
    markLocalTimerAction();

    try {
      const result = await stopTimer({
        notes: sessionLabel.trim() || null,
      });

      if (result.error) {
        const message = result.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to stop timer: ${message}`);
        } else {
          Alert.alert('Error', `Failed to stop timer: ${message}`);
        }
      } else {
        playSound('stop');
        setSessionLabel('');
        void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (Platform.OS === 'web') {
        alert(`Failed to stop timer: ${message}`);
      } else {
        Alert.alert('Error', `Failed to stop timer: ${message}`);
      }
    } finally {
      setIsStopping(false);
    }
  }, [sessionLabel, queryClient, playSound]);

  // Handle transitioning to next pomodoro phase
  const handleNextPhase = useCallback(async () => {
    if (!activeTimer || activeTimer.timer_mode !== 'pomodoro') return;
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    setIsStopping(true);
    markLocalTimerAction();

    try {
      // Stop the current phase (creates an entry)
      const result = await stopTimer({ notes: sessionLabel.trim() || null });
      if (result.error) {
        const message = result.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to complete phase: ${message}`);
        } else {
          Alert.alert('Error', `Failed to complete phase: ${message}`);
        }
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      // Start the next phase
      const info = pomodoro.getNextPhaseInfo();
      const nextResult = await startTimer({
        categoryId: activeTimer.category_id,
        timerMode: 'pomodoro',
        pomodoroPhase: info.phase,
        phaseDurationSeconds: info.duration,
        pomodorosCompleted: info.pomodorosCompleted,
      });

      if (nextResult.error) {
        const message = nextResult.error.message;
        if (Platform.OS === 'web') {
          alert(`Failed to start next phase: ${message}`);
        } else {
          Alert.alert('Error', `Failed to start next phase: ${message}`);
        }
      } else {
        playSound('phase-change');
        const phaseLabel = PHASE_LABELS[info.phase] ?? info.phase;
        sendNotification('Phase Changed', `Starting ${phaseLabel}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (Platform.OS === 'web') {
        alert(`Failed to transition phase: ${message}`);
      } else {
        Alert.alert('Error', `Failed to transition phase: ${message}`);
      }
    } finally {
      setIsStopping(false);
      isTransitioningRef.current = false;
    }
  }, [activeTimer, queryClient, pomodoro, sessionLabel, playSound]);

  // Handle skip phase (stop current, start next)
  const handleSkipPhase = handleNextPhase;

  // Auto-transition when phase completes (guarded by timer ID to prevent loops)
  // Work -> Break always auto-transitions; Break -> Work only if autoStartAfterBreak is enabled
  useEffect(() => {
    if (
      pomodoro.isPhaseComplete &&
      activeTimer?.timer_mode === 'pomodoro' &&
      activeTimer.id !== lastTransitionedTimerIdRef.current &&
      !isTransitioningRef.current
    ) {
      const isBreakPhase =
        pomodoro.currentPhase === 'break' || pomodoro.currentPhase === 'long_break';
      if (isBreakPhase && !pomodoroSettings.autoStartAfterBreak) {
        return;
      }
      lastTransitionedTimerIdRef.current = activeTimer.id;
      void handleNextPhase();
    }
  }, [
    pomodoro.isPhaseComplete,
    pomodoro.currentPhase,
    activeTimer?.timer_mode,
    activeTimer?.id,
    handleNextPhase,
    pomodoroSettings.autoStartAfterBreak,
  ]);

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

  const localElapsed = useTimerStore(state => state.localElapsed);
  const hasActiveTimer = activeTimer !== null;
  const isPomodoroActive = activeTimer?.timer_mode === 'pomodoro';
  const isCountdownActive = activeTimer?.timer_mode === 'countdown';

  // Idle detection — only active when a timer is running
  const handleIdleDetected = useCallback(
    (idleMinutes: number) => {
      const message = `You've been idle for ${idleMinutes} minutes. Discard idle time or keep it?`;
      if (Platform.OS === 'web') {
        const discard = window.confirm(message);
        if (discard) {
          void handleStop();
        }
      } else {
        Alert.alert('Idle Detected', message, [
          { text: 'Keep', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => void handleStop() },
        ]);
      }
    },
    [handleStop]
  );

  useIdleDetection({
    enabled: idleDetectionEnabled && hasActiveTimer,
    thresholdMinutes: idleThresholdMinutes,
    onIdle: handleIdleDetected,
  });

  const timerShortcuts = useMemo(
    () => [
      {
        id: 'toggle-timer',
        key: ' ',
        handler: () => {
          if (isStarting || isStopping) return;
          if (hasActiveTimer) {
            void handleStop();
          } else {
            void handleStart();
          }
        },
        description: 'Start / Stop timer',
      },
    ],
    [hasActiveTimer, isStarting, isStopping, handleStart, handleStop]
  );

  useKeyboardShortcuts(timerShortcuts);

  // Tray sync (Electron only)
  useTraySync();

  // Global shortcut toggle (Electron only)
  useEffect(() => {
    const toggleTimer = () => {
      if (isStarting || isStopping) return;
      if (hasActiveTimer) {
        void handleStop();
      } else {
        void handleStart();
      }
    };
    window.desktop?.onGlobalShortcut(toggleTimer);
  }, [hasActiveTimer, isStarting, isStopping, handleStart, handleStop]);

  // Countdown remaining seconds
  const countdownRemaining = useMemo(() => {
    if (!isCountdownActive || !activeTimer?.phase_duration_seconds) return undefined;
    return Math.max(0, activeTimer.phase_duration_seconds - localElapsed);
  }, [isCountdownActive, activeTimer?.phase_duration_seconds, localElapsed]);

  // Countdown completion alert (guarded like pomodoro transition)
  const countdownAlertedTimerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      isCountdownActive &&
      countdownRemaining === 0 &&
      activeTimer &&
      activeTimer.id !== countdownAlertedTimerIdRef.current
    ) {
      countdownAlertedTimerIdRef.current = activeTimer.id;
      playSound('countdown-complete');
      sendNotification('Countdown Complete', 'Your countdown timer has finished.');
      if (Platform.OS === 'web') {
        alert('Countdown complete!');
      } else {
        Alert.alert('Countdown Complete', 'Your countdown timer has finished.');
      }
    }
  }, [isCountdownActive, countdownRemaining, activeTimer, playSound]);

  // Handle selecting a quick timer preset
  const handleSelectQuickPreset = useCallback(
    (preset: QuickPreset) => {
      setSelectedCategoryId(preset.categoryId);

      if (preset.timerMode === 'pomodoro') {
        updatePomodoroSettings({
          pomodoroEnabled: true,
          countdownEnabled: false,
        });
      } else if (preset.timerMode === 'countdown') {
        updatePomodoroSettings({
          countdownEnabled: true,
          pomodoroEnabled: false,
          ...(preset.durationSeconds != null
            ? { countdownDurationSeconds: preset.durationSeconds }
            : {}),
        });
      } else {
        updatePomodoroSettings({
          pomodoroEnabled: false,
          countdownEnabled: false,
        });
      }

      // Brief delay to let state settle before starting
      setTimeout(() => {
        void handleStart();
      }, 50);
    },
    [updatePomodoroSettings, handleStart]
  );

  // Current duration for saving presets
  const currentDurationSeconds = useMemo(() => {
    if (timerMode === 'countdown') {
      return pomodoroSettings.countdownDurationSeconds;
    }
    if (timerMode === 'pomodoro') {
      return effectiveSettings.workDurationSeconds;
    }
    return null;
  }, [timerMode, pomodoroSettings.countdownDurationSeconds, effectiveSettings.workDurationSeconds]);

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
            <TimerModeDropdown
              pomodoroEnabled={pomodoroSettings.pomodoroEnabled}
              onPomodoroEnabledChange={handlePomodoroEnabledChange}
              countdownEnabled={pomodoroSettings.countdownEnabled}
              onCountdownEnabledChange={handleCountdownEnabledChange}
              countdownDurationSeconds={pomodoroSettings.countdownDurationSeconds}
              onCountdownDurationChange={handleCountdownDurationChange}
              effectiveSettings={effectiveSettings}
              onSettingsChange={handleSessionSettingsChange}
              presets={presets}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
              disabled={hasActiveTimer}
            />
            <View style={styles.headerRight}>
              {hasActiveTimer && (
                <Pressable
                  onPress={() => rootNavigation.navigate('FocusMode')}
                  style={styles.focusButton}
                  accessibilityRole="button"
                  accessibilityLabel="Enter focus mode"
                >
                  <Text variant="caption" style={styles.focusButtonText}>
                    Focus
                  </Text>
                </Pressable>
              )}
              <ConnectionIndicator status={connectionStatus} />
            </View>
          </View>

          {/* Quick timer presets (only when no timer is active) */}
          {!hasActiveTimer && (
            <QuickTimerPresets
              onSelectPreset={handleSelectQuickPreset}
              currentMode={timerMode}
              currentCategoryId={selectedCategoryId}
              currentDurationSeconds={currentDurationSeconds}
            />
          )}

          {/* Main timer card */}
          <Card style={styles.timerCard} padding="lg" elevation="md">
            {/* Pomodoro info (when in pomodoro mode) */}
            {isPomodoroActive && (
              <PomodoroInfo
                phase={pomodoro.currentPhase}
                pomodorosCompleted={pomodoro.pomodorosCompleted}
                pomodorosBeforeLongBreak={pomodoro.settings.pomodorosBeforeLongBreak}
                nextPhase={nextPhaseInfo.phase}
                nextPhaseDurationSeconds={nextPhaseInfo.duration}
                style={styles.pomodoroInfo}
              />
            )}

            {/* Timer display - countdown for pomodoro, elapsed for normal */}
            <TimerDisplay
              countdownSeconds={
                isPomodoroActive
                  ? pomodoro.timeRemainingSeconds
                  : isCountdownActive
                    ? countdownRemaining
                    : undefined
              }
              showElapsed={isPomodoroActive || isCountdownActive}
            />

            {/* Category display */}
            <View style={styles.categorySection}>
              {hasActiveTimer ? (
                // Show active timer's category (read-only)
                <View style={styles.activeCategoryDisplay}>
                  {activeTimerCategory ? (
                    <>
                      <View
                        style={[styles.categoryDot, { backgroundColor: activeTimerCategory.color }]}
                      />
                      <Text variant="body">{activeTimerCategory.name}</Text>
                      <Text variant="caption" color="muted" style={styles.categoryType}>
                        {activeTimerCategory.type}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={[styles.categoryDot, { backgroundColor: colors.textMuted }]} />
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

            {/* Session label input (visible when timer is running) */}
            {hasActiveTimer && (
              <View style={styles.sessionLabelSection}>
                <TextInput
                  style={styles.sessionLabelInput}
                  placeholder="Label this session..."
                  placeholderTextColor={colors.textMuted}
                  value={sessionLabel}
                  onChangeText={setSessionLabel}
                  maxLength={1000}
                />
              </View>
            )}

            {/* Skip phase button (when pomodoro active and phase not complete) */}
            {isPomodoroActive && !pomodoro.isPhaseComplete && (
              <SkipPhaseButton
                onPress={handleSkipPhase}
                loading={isStopping}
                disabled={isStopping}
                nextPhaseLabel={PHASE_LABELS[nextPhaseInfo.phase]}
              />
            )}

            {/* Pomodoro phase complete - show next phase button */}
            {pomodoro.isPhaseComplete && isPomodoroActive && (
              <Button
                variant="primary"
                size="lg"
                onPress={handleNextPhase}
                loading={isStopping}
                disabled={isStopping}
                style={styles.nextPhaseButton}
              >
                {pomodoro.nextPhase === 'work'
                  ? 'Start Focus'
                  : pomodoro.nextPhase === 'long_break'
                    ? 'Start Long Break'
                    : 'Start Break'}
              </Button>
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
  pomodoroInfo: {
    marginBottom: spacing.sm,
  },
  nextPhaseButton: {
    marginBottom: spacing.md,
    minWidth: 200,
    borderRadius: 999,
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
  sessionLabelSection: {
    width: '100%',
    marginBottom: spacing.md,
  },
  sessionLabelInput: {
    backgroundColor: colors.surfaceVariant,
    color: colors.text,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focusButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
  focusButtonText: {
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default TimerScreen;
