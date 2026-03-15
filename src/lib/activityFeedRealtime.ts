/**
 * Activity Feed Realtime Subscription
 *
 * Provides realtime subscriptions for activity feed events within workspaces.
 * Events are filtered by workspace_id and only include INSERT events.
 *
 * Features:
 * - Workspace-scoped subscriptions
 * - Automatic reconnection with exponential backoff
 * - Schema validation with Zod
 * - Status callbacks for connection monitoring
 *
 * @example
 * ```typescript
 * const subscription = createActivityFeedSubscription({
 *   workspaceId: 'workspace-uuid',
 *   onEvent: (payload) => {
 *     console.log('New activity:', payload.new_record);
 *   },
 *   onStatusChange: (status) => {
 *     console.log('Connection status:', status);
 *   },
 * });
 *
 * // Later: cleanup
 * await subscription.unsubscribe();
 * ```
 */

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import { z } from 'zod';

import { ActivityEventSchema, type ActivityEvent } from '../schemas/activityFeed';

// =============================================================================
// CONSTANTS
// =============================================================================

const ACTIVITY_FEED_CHANNEL_PREFIX = 'activity_feed';
const ACTIVITY_FEED_TABLE = 'activity_feed';
const DEFAULT_RECONNECT_DELAY_MS = 2_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const MAX_RECONNECT_DELAY_MS = 30_000;

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Configuration schema for activity feed subscriptions
 */
export const ActivityFeedSubscriptionConfigSchema = z.object({
  /** UUID of the workspace to subscribe to */
  workspaceId: z.string().uuid(),

  /** Base delay in ms for reconnection attempts (default: 2000ms) */
  reconnectDelayMs: z.number().int().positive().max(60_000).optional(),

  /** Maximum number of reconnection attempts (default: 5) */
  maxReconnectAttempts: z.number().int().nonnegative().max(100).optional(),

  /** Custom channel name prefix (default: 'activity_feed') */
  channelName: z.string().trim().min(1).max(100).optional(),
});

// =============================================================================
// TYPES
// =============================================================================

type RealtimeSubscribeState = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

/**
 * Supabase client interface needed for realtime subscriptions
 */
export type ActivityFeedRealtimeClient = Pick<SupabaseClient, 'channel' | 'removeChannel'>;

/**
 * Connection status for activity feed subscriptions
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Normalized payload from activity feed realtime events
 */
export interface ActivityEventRealtimePayload {
  /** Event type (always 'INSERT' for activity feed) */
  eventType: 'INSERT';

  /** The newly created activity event record */
  new_record: ActivityEvent;

  /** Raw payload from Supabase Realtime */
  raw: RealtimePostgresChangesPayload<ActivityEvent>;
}

/**
 * Options for creating an activity feed subscription
 */
export interface CreateActivityFeedSubscriptionOptions {
  /** UUID of the workspace to subscribe to */
  workspaceId: string;

  /** Callback invoked when a new activity event is received */
  onEvent: (payload: ActivityEventRealtimePayload) => void;

  /** Optional callback for connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;

  /** Optional callback for errors */
  onError?: (error: Error) => void;

  /** Base delay in ms for reconnection attempts (default: 2000ms) */
  reconnectDelayMs?: number;

  /** Maximum number of reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;

  /** Custom channel name prefix */
  channelName?: string;

  /** Optional: inject Supabase client for testing */
  client?: ActivityFeedRealtimeClient;
}

/**
 * Handle returned by createActivityFeedSubscription for managing the subscription
 */
export interface ActivityFeedSubscriptionHandle {
  /** Get the underlying realtime channel (may be null if disconnected) */
  getChannel: () => RealtimeChannel | null;

  /** Unsubscribe from the activity feed */
  unsubscribe: () => Promise<'ok' | 'timed out' | 'error'>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a value is a non-null object
 */
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Check if an object has keys
 */
const hasKeys = (value: Record<string, unknown>): boolean => Object.keys(value).length > 0;

/**
 * Convert unknown value to Error
 */
const toError = (value: unknown, fallbackMessage: string): Error =>
  value instanceof Error ? value : new Error(fallbackMessage);

/**
 * Build unique channel name for a workspace subscription
 */
const buildActivityFeedChannelName = (
  workspaceId: string,
  channelName = ACTIVITY_FEED_CHANNEL_PREFIX
): string => `${channelName}:${workspaceId}:${Date.now()}`;

/**
 * Get Supabase client lazily to avoid circular dependencies
 */
const getSupabaseRealtimeClient = (): ActivityFeedRealtimeClient => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase } = require('./supabase') as {
    supabase: ActivityFeedRealtimeClient;
  };

  return supabase;
};

/**
 * Calculate reconnect delay with exponential backoff
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Delay in milliseconds, capped at MAX_RECONNECT_DELAY_MS
 */
export const getReconnectDelayMs = (
  attempt: number,
  baseDelayMs = DEFAULT_RECONNECT_DELAY_MS
): number => {
  const safeAttempt = Math.max(1, Math.trunc(attempt));
  const safeBaseDelay = Math.max(1, Math.trunc(baseDelayMs));

  return Math.min(safeBaseDelay * 2 ** (safeAttempt - 1), MAX_RECONNECT_DELAY_MS);
};

/**
 * Normalize a realtime payload into our typed structure
 *
 * Validates the new record against ActivityEventSchema.
 * Returns null if validation fails.
 *
 * @param payload - Raw payload from Supabase Realtime
 * @returns Normalized payload or null if invalid
 */
export const normalizeActivityFeedPayload = (
  payload: RealtimePostgresChangesPayload<ActivityEvent>
): ActivityEventRealtimePayload | null => {
  // Only handle INSERT events for activity feed
  if (payload.eventType !== 'INSERT') {
    return null;
  }

  // Validate new record
  if (!isObjectRecord(payload.new) || !hasKeys(payload.new)) {
    return null;
  }

  const parsed = ActivityEventSchema.safeParse(payload.new);
  if (!parsed.success) {
    return null;
  }

  return {
    eventType: 'INSERT',
    new_record: parsed.data,
    raw: payload,
  };
};

// =============================================================================
// MAIN SUBSCRIPTION FUNCTION
// =============================================================================

/**
 * Create a realtime subscription for activity feed events in a workspace
 *
 * Subscribes to INSERT events on the activity_feed table filtered by workspace_id.
 * Automatically handles reconnection with exponential backoff.
 *
 * @param options - Subscription configuration options
 * @returns Handle for managing the subscription
 *
 * @example
 * ```typescript
 * const handle = createActivityFeedSubscription({
 *   workspaceId: 'abc-123',
 *   onEvent: (payload) => {
 *     // Handle new activity event
 *     addToFeed(payload.new_record);
 *   },
 *   onStatusChange: (status) => {
 *     setConnectionStatus(status);
 *   },
 *   onError: (error) => {
 *     console.error('Subscription error:', error);
 *   },
 * });
 *
 * // Cleanup when component unmounts
 * return () => {
 *   handle.unsubscribe();
 * };
 * ```
 */
export const createActivityFeedSubscription = (
  options: CreateActivityFeedSubscriptionOptions
): ActivityFeedSubscriptionHandle => {
  // Validate configuration
  const config = ActivityFeedSubscriptionConfigSchema.parse({
    workspaceId: options.workspaceId,
    reconnectDelayMs: options.reconnectDelayMs,
    maxReconnectAttempts: options.maxReconnectAttempts,
    channelName: options.channelName,
  });

  const client = options.client ?? getSupabaseRealtimeClient();
  const reconnectDelayMs = config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const maxReconnectAttempts = config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;

  // Internal state
  let currentChannel: RealtimeChannel | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isStopped = false;

  /**
   * Emit connection status to the callback
   */
  const emitStatus = (status: ConnectionStatus): void => {
    options.onStatusChange?.(status);
  };

  /**
   * Clear any pending reconnect timer
   */
  const clearReconnectTimer = (): void => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  /**
   * Remove the current channel subscription
   */
  const removeCurrentChannel = async (): Promise<'ok' | 'timed out' | 'error'> => {
    if (currentChannel === null) {
      return 'ok';
    }

    const channelToRemove = currentChannel;
    currentChannel = null;
    return client.removeChannel(channelToRemove);
  };

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  const scheduleReconnect = (error: Error): void => {
    if (isStopped) {
      return;
    }

    // Check if we've exceeded max attempts
    if (reconnectAttempts >= maxReconnectAttempts) {
      emitStatus('disconnected');
      options.onError?.(error);
      return;
    }

    // Don't schedule if already scheduled
    if (reconnectTimer !== null) {
      return;
    }

    reconnectAttempts += 1;
    emitStatus('reconnecting');
    options.onError?.(error);

    // Schedule reconnect with exponential backoff
    reconnectTimer = setTimeout(
      () => {
        reconnectTimer = null;
        void connect();
      },
      getReconnectDelayMs(reconnectAttempts, reconnectDelayMs)
    );
  };

  /**
   * Handle a payload received from the realtime subscription
   */
  const handlePayload = (payload: RealtimePostgresChangesPayload<ActivityEvent>): void => {
    const normalizedPayload = normalizeActivityFeedPayload(payload);

    if (!normalizedPayload) {
      // Invalid payload - could be DELETE/UPDATE which we don't handle
      // Or malformed data - log but don't error
      if (payload.eventType === 'INSERT') {
        options.onError?.(
          new Error('Received invalid activity_feed INSERT payload - validation failed.')
        );
      }
      return;
    }

    options.onEvent(normalizedPayload);
  };

  /**
   * Connect to the realtime channel
   */
  const connect = async (): Promise<void> => {
    if (isStopped) {
      return;
    }

    clearReconnectTimer();
    await removeCurrentChannel();

    const nextChannel = client
      .channel(buildActivityFeedChannelName(config.workspaceId, config.channelName))
      .on<ActivityEvent>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: ACTIVITY_FEED_TABLE,
          filter: `workspace_id=eq.${config.workspaceId}`,
        },
        payload => {
          // Ignore if channel changed or stopped
          if (currentChannel !== nextChannel || isStopped) {
            return;
          }

          handlePayload(payload);
        }
      );

    currentChannel = nextChannel;

    // Subscribe and handle status changes
    nextChannel.subscribe((status, error) => {
      // Ignore if channel changed or stopped
      if (currentChannel !== nextChannel || isStopped) {
        return;
      }

      switch (status as RealtimeSubscribeState) {
        case 'SUBSCRIBED':
          reconnectAttempts = 0;
          emitStatus('connected');
          return;

        case 'CHANNEL_ERROR':
          scheduleReconnect(
            toError(error, 'Activity feed realtime subscription encountered an error.')
          );
          return;

        case 'TIMED_OUT':
          scheduleReconnect(toError(error, 'Activity feed realtime subscription timed out.'));
          return;

        case 'CLOSED':
          scheduleReconnect(new Error('Activity feed realtime subscription closed.'));
          return;

        default:
          scheduleReconnect(new Error(`Unknown activity feed realtime status: ${String(status)}`));
      }
    });
  };

  // Start the subscription
  void connect();

  return {
    getChannel: () => currentChannel,
    unsubscribe: async () => {
      isStopped = true;
      clearReconnectTimer();
      emitStatus('disconnected');
      return removeCurrentChannel();
    },
  };
};
