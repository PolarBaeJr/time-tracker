/**
 * Activity Feed Query and Realtime Hooks
 *
 * This module provides TanStack Query hooks for fetching activity feed events
 * and subscribing to realtime updates within a workspace.
 *
 * USAGE:
 * ```typescript
 * import {
 *   useActivityFeed,
 *   useActivityFeedRealtime,
 *   useLatestActivityEvents,
 * } from '@/hooks/useActivityFeed';
 *
 * function ActivityFeedScreen({ workspaceId }: { workspaceId: string }) {
 *   const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivityFeed(workspaceId);
 *   const { connectionStatus } = useActivityFeedRealtime(workspaceId);
 *
 *   const events = data?.pages.flatMap(page => page.events) ?? [];
 *
 *   return (
 *     <div>
 *       <ConnectionIndicator status={connectionStatus} />
 *       {events.map(event => <EventItem key={event.id} event={event} />)}
 *       {hasNextPage && (
 *         <Button onPress={() => fetchNextPage()}>Load More</Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only workspace members can fetch activity events
 * - Events are filtered by workspace_id server-side
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  createActivityFeedSubscription,
  type ActivityEventRealtimePayload,
  type ConnectionStatus,
  type ActivityFeedSubscriptionHandle,
} from '@/lib/activityFeedRealtime';
import {
  ActivityEventWithActorSchema,
  type ActivityEventWithActor,
  type ActivityFeedPage,
} from '@/schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default page size for paginated activity feed queries
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Stale time for activity feed queries (1 minute)
 */
const ACTIVITY_FEED_STALE_TIME = 60 * 1000;

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when activity feed operations fail
 */
export class ActivityFeedFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ActivityFeedFetchError';
  }
}

// ============================================================================
// FETCH TYPES
// ============================================================================

/**
 * Options for fetching activity feed
 */
export interface FetchActivityFeedOptions {
  /** Filter by event types */
  eventTypes?: string[];

  /** Filter by actor user ID */
  actorId?: string;

  /** Only show events after this timestamp */
  since?: string;

  /** Only show events before this timestamp */
  until?: string;

  /** Number of events per page */
  pageSize?: number;

  /** Cursor for pagination (created_at of last event) */
  cursor?: string;
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch a page of activity feed events for a workspace
 *
 * Joins with users table to get actor name/email.
 * Orders by created_at descending (newest first).
 * Uses cursor-based pagination.
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Fetch options for filtering and pagination
 * @returns Promise<ActivityFeedPage> - Page of events with pagination info
 * @throws ActivityFeedFetchError if the fetch fails
 */
export async function fetchActivityFeed(
  workspaceId: string,
  options?: FetchActivityFeedOptions
): Promise<ActivityFeedPage> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;

  // Build the query with join on users
  let query = supabase
    .from('activity_feed')
    .select(
      `
      *,
      actor:users!activity_feed_actor_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  // Apply cursor-based pagination
  if (options?.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  // Apply event type filter
  if (options?.eventTypes && options.eventTypes.length > 0) {
    query = query.in('event_type', options.eventTypes);
  }

  // Apply actor filter
  if (options?.actorId) {
    query = query.eq('actor_user_id', options.actorId);
  }

  // Apply time range filters
  if (options?.since) {
    query = query.gte('created_at', options.since);
  }

  if (options?.until) {
    query = query.lte('created_at', options.until);
  }

  // Fetch one extra to determine if there are more pages
  query = query.limit(pageSize + 1);

  const { data, error } = await query;

  if (error) {
    throw new ActivityFeedFetchError(error.message, error.code);
  }

  if (!data) {
    return {
      events: [],
      next_cursor: null,
      has_more: false,
    };
  }

  // Determine if there are more pages
  const hasMore = data.length > pageSize;
  const pageData = hasMore ? data.slice(0, pageSize) : data;

  // Transform and validate each event
  const validatedEvents: ActivityEventWithActor[] = pageData.map(item => {
    const event = {
      id: item.id,
      workspace_id: item.workspace_id,
      actor_user_id: item.actor_user_id,
      event_type: item.event_type,
      payload: item.payload ?? {},
      created_at: item.created_at,
      actor: item.actor,
    };

    const parsed = ActivityEventWithActorSchema.safeParse(event);
    if (!parsed.success) {
      console.warn('[useActivityFeed] Invalid event data:', item, parsed.error);
      return event as ActivityEventWithActor;
    }

    return parsed.data;
  });

  // Get the cursor for the next page (created_at of the last item)
  const nextCursor =
    validatedEvents.length > 0 ? validatedEvents[validatedEvents.length - 1].created_at : null;

  return {
    events: validatedEvents,
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

/**
 * Fetch latest N activity events for a workspace
 *
 * Used by widgets to show a compact activity preview.
 *
 * @param workspaceId - UUID of the workspace
 * @param count - Number of events to fetch (default: 5)
 * @returns Promise<ActivityEventWithActor[]> - Latest events
 * @throws ActivityFeedFetchError if the fetch fails
 */
export async function fetchLatestActivityEvents(
  workspaceId: string,
  count = 5
): Promise<ActivityEventWithActor[]> {
  const result = await fetchActivityFeed(workspaceId, { pageSize: count });
  return result.events;
}

// ============================================================================
// INFINITE QUERY HOOK
// ============================================================================

/**
 * Options for the useActivityFeed hook
 */
export interface UseActivityFeedOptions {
  /** Filter by event types */
  eventTypes?: string[];

  /** Filter by actor user ID */
  actorId?: string;

  /** Only show events after this timestamp */
  since?: string;

  /** Only show events before this timestamp */
  until?: string;

  /** Number of events per page (default: 20) */
  pageSize?: number;

  /** Whether the query should be enabled */
  enabled?: boolean;

  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Hook to fetch paginated activity feed for a workspace
 *
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination.
 * Events are ordered by created_at descending (newest first).
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Configuration options including filters and pagination
 * @returns React Query infinite query result with activity events
 *
 * @example
 * ```typescript
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 * } = useActivityFeed(workspaceId, {
 *   eventTypes: ['entry_logged', 'entry_approved'],
 *   pageSize: 10,
 * });
 *
 * const allEvents = data?.pages.flatMap(page => page.events) ?? [];
 * ```
 */
export function useActivityFeed(workspaceId: string, options?: UseActivityFeedOptions) {
  const {
    eventTypes,
    actorId,
    since,
    until,
    pageSize = DEFAULT_PAGE_SIZE,
    enabled = true,
    staleTime = ACTIVITY_FEED_STALE_TIME,
  } = options ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.activityFeed(workspaceId),
    queryFn: ({ pageParam }) =>
      fetchActivityFeed(workspaceId, {
        eventTypes,
        actorId,
        since,
        until,
        pageSize,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.next_cursor ?? undefined,
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

// ============================================================================
// REALTIME SUBSCRIPTION HOOK
// ============================================================================

/**
 * Options for the useActivityFeedRealtime hook
 */
export interface UseActivityFeedRealtimeOptions {
  /** Whether the subscription should be active */
  enabled?: boolean;

  /** Callback when a new event is received */
  onEvent?: (event: ActivityEventWithActor) => void;

  /** Callback when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Result from useActivityFeedRealtime hook
 */
export interface UseActivityFeedRealtimeResult {
  /** Current connection status */
  connectionStatus: ConnectionStatus;

  /** Whether currently connected */
  isConnected: boolean;

  /** Whether currently reconnecting */
  isReconnecting: boolean;
}

/**
 * Hook to subscribe to realtime activity feed events
 *
 * Automatically prepends new events to the activity feed query cache.
 * Handles connection status and automatic reconnection.
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Configuration options
 * @returns Connection status information
 *
 * @example
 * ```typescript
 * const { connectionStatus, isConnected } = useActivityFeedRealtime(workspaceId, {
 *   onEvent: (event) => {
 *     // Handle new event (e.g., show notification)
 *     showNotification(`${event.actor.name} ${formatEventDescription(event)}`);
 *   },
 *   onStatusChange: (status) => {
 *     console.log('Connection status:', status);
 *   },
 * });
 * ```
 */
export function useActivityFeedRealtime(
  workspaceId: string,
  options?: UseActivityFeedRealtimeOptions
): UseActivityFeedRealtimeResult {
  const { enabled = true, onEvent, onStatusChange, onError } = options ?? {};

  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const subscriptionRef = useRef<ActivityFeedSubscriptionHandle | null>(null);

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleEvent = useCallback(
    async (payload: ActivityEventRealtimePayload) => {
      // Fetch actor details for the new event
      const { data: actorData } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', payload.new_record.actor_user_id)
        .single();

      const eventWithActor: ActivityEventWithActor = {
        ...payload.new_record,
        actor: actorData ?? {
          id: payload.new_record.actor_user_id,
          email: 'unknown@example.com',
          name: null,
        },
      };

      // Prepend to query cache
      queryClient.setQueryData(queryKeys.activityFeed(workspaceId), (oldData: unknown) => {
        if (!oldData) return oldData;

        const typedData = oldData as {
          pages: ActivityFeedPage[];
          pageParams: (string | undefined)[];
        };

        // Prepend new event to first page
        const newPages = [...typedData.pages];
        if (newPages.length > 0) {
          newPages[0] = {
            ...newPages[0],
            events: [eventWithActor, ...newPages[0].events],
          };
        }

        return {
          ...typedData,
          pages: newPages,
        };
      });

      // Call user's onEvent callback
      onEvent?.(eventWithActor);
    },
    [workspaceId, queryClient, onEvent]
  );

  const handleStatusChange = useCallback(
    (status: ConnectionStatus) => {
      setConnectionStatus(status);
      onStatusChange?.(status);
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (!enabled || !workspaceId) {
      return;
    }

    // Create subscription
    subscriptionRef.current = createActivityFeedSubscription({
      workspaceId,
      onEvent: handleEvent,
      onStatusChange: handleStatusChange,
      onError,
    });

    // Cleanup on unmount or dependency change
    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [enabled, workspaceId, handleEvent, handleStatusChange, onError]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isReconnecting: connectionStatus === 'reconnecting',
  };
}

// ============================================================================
// LATEST EVENTS HOOK
// ============================================================================

/**
 * Options for the useLatestActivityEvents hook
 */
export interface UseLatestActivityEventsOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;

  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Hook to fetch the latest N activity events for a workspace
 *
 * Used by widgets to show a compact activity preview.
 *
 * @param workspaceId - UUID of the workspace
 * @param count - Number of events to fetch (default: 5)
 * @param options - Configuration options
 * @returns React Query result with latest events
 *
 * @example
 * ```typescript
 * const { data: events, isLoading } = useLatestActivityEvents(workspaceId, 5);
 * ```
 */
export function useLatestActivityEvents(
  workspaceId: string,
  count = 5,
  options?: UseLatestActivityEventsOptions
) {
  const { enabled = true, staleTime = ACTIVITY_FEED_STALE_TIME } = options ?? {};

  return useQuery({
    queryKey: [...queryKeys.activityFeed(workspaceId), 'latest', count],
    queryFn: () => fetchLatestActivityEvents(workspaceId, count),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseActivityFeedResult = ReturnType<typeof useActivityFeed>;
export type UseLatestActivityEventsResult = ReturnType<typeof useLatestActivityEvents>;
