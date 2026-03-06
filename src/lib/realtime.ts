import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import { z } from 'zod';

import { ActiveTimerSchema, type ActiveTimer } from '../schemas/timer';

const PartialActiveTimerSchema = ActiveTimerSchema.partial();

const ActiveTimerSubscriptionConfigSchema = z.object({
  userId: z.string().uuid(),
  reconnectDelayMs: z.number().int().positive().max(60_000).optional(),
  maxReconnectAttempts: z.number().int().nonnegative().max(100).optional(),
  channelName: z.string().trim().min(1).max(100).optional(),
});

const ACTIVE_TIMERS_CHANNEL_PREFIX = 'active_timers';
const ACTIVE_TIMERS_TABLE = 'active_timers';
const DEFAULT_RECONNECT_DELAY_MS = 2_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const MAX_RECONNECT_DELAY_MS = 30_000;

type RealtimeSubscribeState =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR';

export type ActiveTimerRealtimeClient = Pick<SupabaseClient, 'channel' | 'removeChannel'>;
export type ActiveTimerConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
export type ActiveTimerRealtimeEventType =
  RealtimePostgresChangesPayload<ActiveTimer>['eventType'];

export interface ActiveTimerRealtimePayload {
  eventType: ActiveTimerRealtimeEventType;
  old_record: Partial<ActiveTimer> | null;
  new_record: ActiveTimer | null;
  raw: RealtimePostgresChangesPayload<ActiveTimer>;
}

export interface CreateActiveTimerSubscriptionOptions {
  userId: string;
  onEvent: (payload: ActiveTimerRealtimePayload) => void;
  onStatusChange?: (status: ActiveTimerConnectionStatus) => void;
  onError?: (error: Error) => void;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  channelName?: string;
  client?: ActiveTimerRealtimeClient;
}

export interface ActiveTimerSubscriptionHandle {
  getChannel: () => RealtimeChannel | null;
  unsubscribe: () => Promise<'ok' | 'timed out' | 'error'>;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasKeys = (value: Record<string, unknown>): boolean => Object.keys(value).length > 0;

const parseNewRecord = (value: unknown): ActiveTimer | null => {
  if (!isObjectRecord(value) || !hasKeys(value)) {
    return null;
  }

  const parsed = ActiveTimerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseOldRecord = (value: unknown): Partial<ActiveTimer> | null => {
  if (!isObjectRecord(value) || !hasKeys(value)) {
    return null;
  }

  const parsed = PartialActiveTimerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const toError = (value: unknown, fallbackMessage: string): Error =>
  value instanceof Error ? value : new Error(fallbackMessage);

const buildActiveTimerChannelName = (
  userId: string,
  channelName = ACTIVE_TIMERS_CHANNEL_PREFIX
): string => `${channelName}:${userId}:${Date.now()}`;

const getSupabaseRealtimeClient = (): ActiveTimerRealtimeClient => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase } = require('./supabase') as {
    supabase: ActiveTimerRealtimeClient;
  };

  return supabase;
};

export const getReconnectDelayMs = (
  attempt: number,
  baseDelayMs = DEFAULT_RECONNECT_DELAY_MS
): number => {
  const safeAttempt = Math.max(1, Math.trunc(attempt));
  const safeBaseDelay = Math.max(1, Math.trunc(baseDelayMs));

  return Math.min(
    safeBaseDelay * 2 ** (safeAttempt - 1),
    MAX_RECONNECT_DELAY_MS
  );
};

export const normalizeActiveTimerRealtimePayload = (
  payload: RealtimePostgresChangesPayload<ActiveTimer>
): ActiveTimerRealtimePayload => ({
  eventType: payload.eventType,
  old_record: parseOldRecord(payload.old),
  new_record: parseNewRecord(payload.new),
  raw: payload,
});

export const isValidActiveTimerRealtimePayload = (
  payload: ActiveTimerRealtimePayload
): boolean => {
  switch (payload.eventType) {
    case 'INSERT':
      return payload.new_record !== null;
    case 'UPDATE':
      return payload.new_record !== null;
    case 'DELETE':
      return payload.old_record !== null;
    default:
      return false;
  }
};

export const createActiveTimerSubscription = (
  options: CreateActiveTimerSubscriptionOptions
): ActiveTimerSubscriptionHandle => {
  const config = ActiveTimerSubscriptionConfigSchema.parse({
    userId: options.userId,
    reconnectDelayMs: options.reconnectDelayMs,
    maxReconnectAttempts: options.maxReconnectAttempts,
    channelName: options.channelName,
  });

  const client = options.client ?? getSupabaseRealtimeClient();
  const reconnectDelayMs = config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const maxReconnectAttempts =
    config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;

  let currentChannel: RealtimeChannel | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isStopped = false;

  const emitStatus = (status: ActiveTimerConnectionStatus): void => {
    options.onStatusChange?.(status);
  };

  const clearReconnectTimer = (): void => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const removeCurrentChannel = async (): Promise<'ok' | 'timed out' | 'error'> => {
    if (currentChannel === null) {
      return 'ok';
    }

    const channelToRemove = currentChannel;
    currentChannel = null;
    return client.removeChannel(channelToRemove);
  };

  const scheduleReconnect = (error: Error): void => {
    if (isStopped) {
      return;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      emitStatus('disconnected');
      options.onError?.(error);
      return;
    }

    if (reconnectTimer !== null) {
      return;
    }

    reconnectAttempts += 1;
    emitStatus('reconnecting');
    options.onError?.(error);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, getReconnectDelayMs(reconnectAttempts, reconnectDelayMs));
  };

  const handlePayload = (payload: RealtimePostgresChangesPayload<ActiveTimer>): void => {
    const normalizedPayload = normalizeActiveTimerRealtimePayload(payload);

    if (!isValidActiveTimerRealtimePayload(normalizedPayload)) {
      options.onError?.(
        new Error(`Received invalid active_timers ${payload.eventType} payload.`)
      );
      return;
    }

    options.onEvent(normalizedPayload);
  };

  const connect = async (): Promise<void> => {
    if (isStopped) {
      return;
    }

    clearReconnectTimer();
    await removeCurrentChannel();

    const nextChannel = client
      .channel(buildActiveTimerChannelName(config.userId, config.channelName))
      .on<ActiveTimer>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: ACTIVE_TIMERS_TABLE,
          filter: `user_id=eq.${config.userId}`,
        },
        (payload) => {
          if (currentChannel !== nextChannel || isStopped) {
            return;
          }

          handlePayload(payload);
        }
      );

    currentChannel = nextChannel;

    nextChannel.subscribe((status, error) => {
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
            toError(error, 'Active timer realtime subscription encountered an error.')
          );
          return;
        case 'TIMED_OUT':
          scheduleReconnect(
            toError(error, 'Active timer realtime subscription timed out.')
          );
          return;
        case 'CLOSED':
          scheduleReconnect(new Error('Active timer realtime subscription closed.'));
          return;
        default:
          scheduleReconnect(
            new Error(`Unknown active timer realtime status: ${String(status)}`)
          );
      }
    });
  };

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
