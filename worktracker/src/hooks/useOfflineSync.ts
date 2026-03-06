/**
 * Offline Sync Hook
 *
 * Manages synchronization of offline-queued actions when the device comes back online.
 * Processes queue in order, handles conflicts (server wins), and retries failed syncs
 * with exponential backoff.
 *
 * USAGE:
 * ```typescript
 * import { useOfflineSync } from '@/hooks/useOfflineSync';
 *
 * function App() {
 *   const {
 *     isSyncing,
 *     lastSyncAt,
 *     queuedCount,
 *     failedCount,
 *     syncNow,
 *   } = useOfflineSync({
 *     onSyncStart: () => console.log('Sync started'),
 *     onSyncComplete: (results) => console.log('Sync complete', results),
 *     onConflict: (action, error) => console.log('Conflict', action, error),
 *   });
 *
 *   return (
 *     <View>
 *       {queuedCount > 0 && <Badge>{queuedCount} pending</Badge>}
 *       <Button onPress={syncNow} disabled={isSyncing}>
 *         Sync Now
 *       </Button>
 *     </View>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { supabase } from '@/lib/supabase';
import { queryClient, queryKeys } from '@/lib/queryClient';
import {
  offlineQueue,
  validateQueuedAction,
  calculateBackoffDelay,
  MAX_RETRY_ATTEMPTS,
  type CreateEntryPayload,
  type UpdateEntryPayload,
  type DeleteEntryPayload,
} from '@/services/offlineQueue';
import { useNetworkStatus } from './useNetworkStatus';
import type { QueuedAction, TimeEntry } from '@/schemas';

/**
 * Result of processing a single action
 */
export interface ActionResult {
  action: QueuedAction;
  success: boolean;
  error?: string;
  /** Whether this was a conflict that was resolved server-side */
  wasConflict?: boolean;
  /** The created/updated data from the server */
  data?: TimeEntry;
}

/**
 * Results of a sync operation
 */
export interface SyncResults {
  /** Total actions processed */
  total: number;
  /** Actions that succeeded */
  succeeded: number;
  /** Actions that failed but will be retried */
  failed: number;
  /** Actions that exceeded retry limit (permanently failed) */
  permanentlyFailed: number;
  /** Actions that had conflicts (server wins) */
  conflicts: number;
  /** Individual action results */
  results: ActionResult[];
}

/**
 * Options for useOfflineSync hook
 */
export interface UseOfflineSyncOptions {
  /**
   * Whether to automatically sync when coming online (default: true)
   */
  autoSyncOnReconnect?: boolean;

  /**
   * Callback when sync starts
   */
  onSyncStart?: () => void;

  /**
   * Callback when sync completes
   */
  onSyncComplete?: (results: SyncResults) => void;

  /**
   * Callback when a conflict is detected (server wins)
   */
  onConflict?: (action: QueuedAction, serverError: string) => void;

  /**
   * Callback when an action fails permanently (exceeded retries)
   */
  onPermanentFailure?: (action: QueuedAction) => void;

  /**
   * Delay between processing actions in milliseconds (default: 100)
   */
  actionDelayMs?: number;
}

/**
 * Result of the useOfflineSync hook
 */
export interface UseOfflineSyncResult {
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Last successful sync timestamp */
  lastSyncAt: Date | null;
  /** Number of actions in the queue */
  queuedCount: number;
  /** Number of permanently failed actions */
  failedCount: number;
  /** Whether the device is online */
  isOnline: boolean;
  /** Manually trigger a sync */
  syncNow: () => Promise<SyncResults | null>;
  /** Clear all failed actions from the queue */
  clearFailedActions: () => Promise<number>;
  /** Clear the entire queue */
  clearQueue: () => Promise<void>;
  /** Refresh queue counts */
  refreshCounts: () => Promise<void>;
}

/**
 * Process a single queued action
 *
 * @param action - The action to process
 * @returns Promise resolving to the action result
 */
async function processAction(action: QueuedAction): Promise<ActionResult> {
  // Re-validate the action before syncing
  const validation = validateQueuedAction(action);
  if (!validation.valid) {
    return {
      action,
      success: false,
      error: validation.error ?? 'Validation failed',
    };
  }

  try {
    switch (action.action) {
      case 'create_entry': {
        const payload = action.payload as CreateEntryPayload;

        const { data, error } = await supabase
          .from('time_entries')
          .insert({
            category_id: payload.category_id,
            start_at: payload.start_at,
            end_at: payload.end_at,
            duration_seconds: payload.duration_seconds,
            notes: payload.notes,
          })
          .select()
          .single();

        if (error) {
          // Check for conflict indicators
          const isConflict =
            error.code === '23505' || // Unique violation
            error.code === '23503' || // Foreign key violation
            error.message.includes('conflict');

          return {
            action,
            success: false,
            error: error.message,
            wasConflict: isConflict,
          };
        }

        return {
          action,
          success: true,
          data: data as TimeEntry,
        };
      }

      case 'update_entry': {
        const payload = action.payload as unknown as UpdateEntryPayload;

        // Check if the entry still exists
        const { data: existing, error: fetchError } = await supabase
          .from('time_entries')
          .select('id, updated_at')
          .eq('id', payload.id)
          .single();

        if (fetchError || !existing) {
          // Entry was deleted on server - this is a conflict
          return {
            action,
            success: false,
            error: 'Entry no longer exists on server',
            wasConflict: true,
          };
        }

        const { data, error } = await supabase
          .from('time_entries')
          .update(payload.data)
          .eq('id', payload.id)
          .select()
          .single();

        if (error) {
          return {
            action,
            success: false,
            error: error.message,
            wasConflict: error.code === '23503', // Foreign key (category deleted)
          };
        }

        return {
          action,
          success: true,
          data: data as TimeEntry,
        };
      }

      case 'delete_entry': {
        const payload = action.payload as unknown as DeleteEntryPayload;

        const { error } = await supabase
          .from('time_entries')
          .delete()
          .eq('id', payload.id);

        if (error) {
          // If entry doesn't exist, that's fine - it's already deleted
          if (error.code === 'PGRST116') {
            return { action, success: true };
          }
          return {
            action,
            success: false,
            error: error.message,
          };
        }

        return { action, success: true };
      }

      default:
        return {
          action,
          success: false,
          error: `Unknown action type: ${action.action}`,
        };
    }
  } catch (err) {
    return {
      action,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Hook to manage offline queue synchronization
 *
 * @param options - Configuration options
 * @returns Sync state and control functions
 */
export function useOfflineSync(options?: UseOfflineSyncOptions): UseOfflineSyncResult {
  const {
    autoSyncOnReconnect = true,
    onSyncStart,
    onSyncComplete,
    onConflict,
    onPermanentFailure,
    actionDelayMs = 100,
  } = options ?? {};

  const { isOnline } = useNetworkStatus();

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const syncingRef = useRef(false);
  const mountedRef = useRef(true);
  const wasOnlineRef = useRef(isOnline);

  /**
   * Refresh queue counts from storage
   */
  const refreshCounts = useCallback(async () => {
    if (!mountedRef.current) return;

    const [queued, failed] = await Promise.all([
      offlineQueue.getQueueLength(),
      offlineQueue.getFailedActions().then((a) => a.length),
    ]);

    if (mountedRef.current) {
      setQueuedCount(queued);
      setFailedCount(failed);
    }
  }, []);

  /**
   * Process the queue
   */
  const syncNow = useCallback(async (): Promise<SyncResults | null> => {
    // Prevent concurrent syncs
    if (syncingRef.current || !isOnline) {
      return null;
    }

    syncingRef.current = true;
    setIsSyncing(true);
    onSyncStart?.();

    const results: SyncResults = {
      total: 0,
      succeeded: 0,
      failed: 0,
      permanentlyFailed: 0,
      conflicts: 0,
      results: [],
    };

    try {
      const actions = await offlineQueue.getRetryableActions();
      results.total = actions.length;

      for (const action of actions) {
        if (!mountedRef.current) break;

        const result = await processAction(action);
        results.results.push(result);

        if (result.success) {
          // Remove from queue
          await offlineQueue.removeFromQueue(action.id);
          results.succeeded++;
        } else {
          // Handle conflicts
          if (result.wasConflict) {
            results.conflicts++;
            onConflict?.(action, result.error ?? 'Conflict');
            // Remove conflicting actions from queue (server wins)
            await offlineQueue.removeFromQueue(action.id);
          } else {
            // Increment retry count
            const updated = await offlineQueue.incrementRetryCount(action.id);

            if (updated && updated.retryCount >= MAX_RETRY_ATTEMPTS) {
              results.permanentlyFailed++;
              onPermanentFailure?.(action);
            } else {
              results.failed++;

              // Wait with exponential backoff before next attempt
              const delay = calculateBackoffDelay(action.retryCount);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        // Small delay between actions to avoid overwhelming the server
        if (actionDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, actionDelayMs));
        }
      }

      // Invalidate time entries cache to refresh UI
      if (results.succeeded > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      }

      if (mountedRef.current) {
        setLastSyncAt(new Date());
        await refreshCounts();
      }

      onSyncComplete?.(results);
      return results;
    } finally {
      syncingRef.current = false;
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [
    isOnline,
    actionDelayMs,
    onSyncStart,
    onSyncComplete,
    onConflict,
    onPermanentFailure,
    refreshCounts,
  ]);

  /**
   * Clear failed actions
   */
  const clearFailedActions = useCallback(async (): Promise<number> => {
    const removed = await offlineQueue.clearFailedActions();
    await refreshCounts();
    return removed;
  }, [refreshCounts]);

  /**
   * Clear entire queue
   */
  const clearQueue = useCallback(async (): Promise<void> => {
    await offlineQueue.clearQueue();
    await refreshCounts();
  }, [refreshCounts]);

  // Initial count load
  useEffect(() => {
    mountedRef.current = true;
    refreshCounts();

    return () => {
      mountedRef.current = false;
    };
  }, [refreshCounts]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!autoSyncOnReconnect) return;

    // Check if we just came online
    if (isOnline && !wasOnlineRef.current) {
      // Small delay to ensure network is stable
      const timeoutId = setTimeout(() => {
        syncNow();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline, autoSyncOnReconnect, syncNow]);

  return {
    isSyncing,
    lastSyncAt,
    queuedCount,
    failedCount,
    isOnline,
    syncNow,
    clearFailedActions,
    clearQueue,
    refreshCounts,
  };
}

/**
 * Queue a create entry action for offline processing
 *
 * @param payload - The entry data to create
 */
export async function queueCreateEntry(payload: CreateEntryPayload): Promise<void> {
  const action: QueuedAction = {
    id: crypto.randomUUID(),
    action: 'create_entry',
    payload: payload as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  await offlineQueue.addToQueue(action);
}

/**
 * Queue an update entry action for offline processing
 *
 * @param id - The entry ID to update
 * @param data - The update data
 */
export async function queueUpdateEntry(
  id: string,
  data: UpdateEntryPayload['data']
): Promise<void> {
  const action: QueuedAction = {
    id: crypto.randomUUID(),
    action: 'update_entry',
    payload: { id, data } as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  await offlineQueue.addToQueue(action);
}

/**
 * Queue a delete entry action for offline processing
 *
 * @param id - The entry ID to delete
 */
export async function queueDeleteEntry(id: string): Promise<void> {
  const action: QueuedAction = {
    id: crypto.randomUUID(),
    action: 'delete_entry',
    payload: { id } as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  await offlineQueue.addToQueue(action);
}

export type {
  ActionResult as OfflineSyncActionResult,
  SyncResults as OfflineSyncResults,
};
