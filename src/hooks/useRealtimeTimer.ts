/**
 * Real-time Timer Subscription Hook
 *
 * This hook subscribes to active_timers table changes for the current user
 * using Supabase Realtime. It automatically updates the timer store when
 * changes are detected from any device.
 *
 * USAGE:
 * ```typescript
 * import { useRealtimeTimer } from '@/hooks/useRealtimeTimer';
 *
 * function TimerComponent() {
 *   const { connectionStatus, isConnected, lastSyncMessage } = useRealtimeTimer();
 *
 *   return (
 *     <View>
 *       <ConnectionIndicator status={connectionStatus} />
 *       {lastSyncMessage && <Toast message={lastSyncMessage} />}
 *     </View>
 *   );
 * }
 * ```
 *
 * FEATURES:
 * - Subscribes to INSERT/UPDATE/DELETE events on active_timers
 * - Updates timer store with new data from server
 * - Tracks connection status (connected/reconnecting/disconnected)
 * - Shows notification message when timer changes from another device
 * - Automatic cleanup on unmount
 * - Reconnection with exponential backoff on errors
 *
 * SECURITY:
 * - Subscription is filtered by user_id via RLS policies
 * - Only authenticated users can subscribe to their own timer data
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createActiveTimerSubscription,
  type ActiveTimerConnectionStatus,
  type ActiveTimerRealtimePayload,
  type ActiveTimerSubscriptionHandle,
} from '@/lib/realtime';
import { getTimerStoreState } from '@/stores';
import { useAuth } from './useAuth';

/**
 * Module-level timestamp tracking the last local timer action.
 * Used to distinguish local actions from remote changes.
 * This is shared across all instances of the hook.
 */
let lastLocalActionTimestamp = 0;

/**
 * Mark that a local timer action is about to occur.
 * Call this before starting/stopping a timer locally to prevent
 * false "changed on another device" notifications.
 *
 * @example
 * ```typescript
 * import { markLocalTimerAction } from '@/hooks/useRealtimeTimer';
 *
 * async function handleStartTimer() {
 *   markLocalTimerAction();
 *   await startTimer({ categoryId });
 * }
 * ```
 */
export function markLocalTimerAction(): void {
  lastLocalActionTimestamp = Date.now();
}

/**
 * Result of the useRealtimeTimer hook
 */
export interface UseRealtimeTimerResult {
  /** Current connection status */
  connectionStatus: ActiveTimerConnectionStatus;
  /** Whether the subscription is connected */
  isConnected: boolean;
  /** Whether the subscription is reconnecting */
  isReconnecting: boolean;
  /** Whether the subscription is disconnected */
  isDisconnected: boolean;
  /** Last sync message (for toast notifications) */
  lastSyncMessage: string | null;
  /** Clear the last sync message */
  clearSyncMessage: () => void;
  /** Last error that occurred */
  lastError: Error | null;
  /** Clear the last error */
  clearError: () => void;
  /** Mark that a local timer action is about to occur */
  markLocalAction: () => void;
}

/**
 * Options for useRealtimeTimer hook
 */
export interface UseRealtimeTimerOptions {
  /**
   * Whether the subscription is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Base delay in ms for reconnection attempts
   * @default 2000
   */
  reconnectDelayMs?: number;
  /**
   * Maximum number of reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number;
  /**
   * Callback when timer changes from another device
   */
  onTimerChange?: (message: string) => void;
  /**
   * Callback when connection status changes
   */
  onConnectionStatusChange?: (status: ActiveTimerConnectionStatus) => void;
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Generate a human-readable message for timer changes
 */
function getTimerChangeMessage(
  eventType: ActiveTimerRealtimePayload['eventType'],
  isFromAnotherDevice: boolean
): string | null {
  if (!isFromAnotherDevice) {
    return null;
  }

  switch (eventType) {
    case 'INSERT':
      return 'Timer started on another device';
    case 'UPDATE':
      return 'Timer updated on another device';
    case 'DELETE':
      return 'Timer stopped on another device';
    default:
      return null;
  }
}

/**
 * Hook to subscribe to real-time timer updates
 *
 * Automatically subscribes to the active_timers table for the current user
 * and updates the timer store when changes occur.
 *
 * @param options - Optional configuration
 * @returns Subscription state and controls
 *
 * @example
 * ```typescript
 * function TimerScreen() {
 *   const { connectionStatus, lastSyncMessage, clearSyncMessage } = useRealtimeTimer({
 *     onTimerChange: (message) => {
 *       showToast(message);
 *     },
 *   });
 *
 *   return (
 *     <View>
 *       <ConnectionStatus status={connectionStatus} />
 *       <TimerDisplay />
 *     </View>
 *   );
 * }
 * ```
 */
export function useRealtimeTimer(
  options: UseRealtimeTimerOptions = {}
): UseRealtimeTimerResult {
  const {
    enabled = true,
    reconnectDelayMs,
    maxReconnectAttempts,
    onTimerChange,
    onConnectionStatusChange,
    onError,
  } = options;

  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  // Track connection status
  const [connectionStatus, setConnectionStatus] =
    useState<ActiveTimerConnectionStatus>('disconnected');

  // Track last sync message for toast notifications
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  // Track last error
  const [lastError, setLastError] = useState<Error | null>(null);

  // Subscription handle ref
  const subscriptionRef = useRef<ActiveTimerSubscriptionHandle | null>(null);

  // Clear sync message
  const clearSyncMessage = useCallback(() => {
    setLastSyncMessage(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Handle realtime events
  const handleEvent = useCallback(
    (payload: ActiveTimerRealtimePayload) => {
      const store = getTimerStoreState();

      // Determine if this change was from another device
      // If we recently performed a local action, assume it's our change
      const timeSinceLocalAction = Date.now() - lastLocalActionTimestamp;
      const isFromAnotherDevice = timeSinceLocalAction > 3000; // 3 second threshold

      switch (payload.eventType) {
        case 'INSERT':
        case 'UPDATE':
          // Update store with new timer data
          if (payload.new_record) {
            store.syncFromServer(payload.new_record);
          }
          break;

        case 'DELETE':
          // Timer was stopped - clear active timer
          store.syncFromServer(null);
          break;
      }

      // Generate notification message for changes from other devices
      const message = getTimerChangeMessage(payload.eventType, isFromAnotherDevice);
      if (message) {
        setLastSyncMessage(message);
        onTimerChange?.(message);
      }
    },
    [onTimerChange]
  );

  // Handle connection status changes
  const handleStatusChange = useCallback(
    (status: ActiveTimerConnectionStatus) => {
      setConnectionStatus(status);
      onConnectionStatusChange?.(status);
    },
    [onConnectionStatusChange]
  );

  // Handle errors
  const handleError = useCallback(
    (error: Error) => {
      setLastError(error);
      onError?.(error);
      console.warn('[useRealtimeTimer] Subscription error:', error.message);
    },
    [onError]
  );

  // Track if subscription should be active
  const shouldSubscribe = enabled && isAuthenticated && !!userId;

  // Subscribe/unsubscribe based on auth state and enabled flag
  useEffect(() => {
    // Don't subscribe if conditions not met
    if (!shouldSubscribe || !userId) {
      // Ensure we're disconnected - cleanup any existing subscription
      if (subscriptionRef.current) {
        void subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      // Don't call setConnectionStatus here - it's handled by handleStatusChange
      // or the initial state is already 'disconnected'
      return;
    }

    // Create subscription
    const subscription = createActiveTimerSubscription({
      userId,
      onEvent: handleEvent,
      onStatusChange: handleStatusChange,
      onError: handleError,
      reconnectDelayMs,
      maxReconnectAttempts,
    });

    subscriptionRef.current = subscription;

    // Cleanup on unmount or when dependencies change
    return () => {
      void subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [
    shouldSubscribe,
    userId,
    handleEvent,
    handleStatusChange,
    handleError,
    reconnectDelayMs,
    maxReconnectAttempts,
  ]);

  // Handle disconnection status when subscription is disabled
  // Using a separate effect avoids the synchronous setState issue
  useEffect(() => {
    if (!shouldSubscribe && connectionStatus !== 'disconnected') {
      // Use a microtask to avoid synchronous setState
      queueMicrotask(() => {
        setConnectionStatus('disconnected');
      });
    }
  }, [shouldSubscribe, connectionStatus]);

  // Derived connection states
  const isConnected = connectionStatus === 'connected';
  const isReconnecting = connectionStatus === 'reconnecting';
  const isDisconnected = connectionStatus === 'disconnected';

  // Memoize result to prevent unnecessary re-renders
  return useMemo(
    () => ({
      connectionStatus,
      isConnected,
      isReconnecting,
      isDisconnected,
      lastSyncMessage,
      clearSyncMessage,
      lastError,
      clearError,
      markLocalAction: markLocalTimerAction,
    }),
    [
      connectionStatus,
      isConnected,
      isReconnecting,
      isDisconnected,
      lastSyncMessage,
      clearSyncMessage,
      lastError,
      clearError,
    ]
  );
}

/**
 * Hook that returns a stable markLocalAction callback.
 * Use this when you need a stable reference for timer controls.
 *
 * @deprecated Use `markLocalTimerAction` directly or `useRealtimeTimer().markLocalAction` instead
 */
export function useMarkLocalTimerAction(): () => void {
  return useCallback(() => {
    markLocalTimerAction();
  }, []);
}

// Re-export connection status type for convenience
export type { ActiveTimerConnectionStatus };
