import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';
import { ActiveTimerSchema, QueuedActionSchema } from '@/schemas';
import type { ActiveTimer, QueuedAction } from '@/types';

const TIMER_STORE_STORAGE_KEY = 'worktracker.timer-store.v1';

interface TimerStoreState {
  activeTimer: ActiveTimer | null;
  localElapsed: number;
  isRunning: boolean;
  offlineQueue: QueuedAction[];
  setActiveTimer: (timer: ActiveTimer | null) => void;
  startLocalTick: () => void;
  stopLocalTick: () => void;
  queueAction: (action: QueuedAction) => void;
  clearQueue: () => void;
  syncFromServer: (timer: ActiveTimer | null) => void;
}

interface PersistedTimerState {
  activeTimer: ActiveTimer | null;
  offlineQueue: QueuedAction[];
}

type Listener = () => void;

const listeners = new Set<Listener>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

const calculateElapsedSeconds = (timer: ActiveTimer | null): number => {
  if (!timer) {
    return 0;
  }

  const startedAtMs = Date.parse(timer.started_at);
  if (Number.isNaN(startedAtMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
};

const notifyListeners = (): void => {
  listeners.forEach((listener) => listener());
};

const persistState = async (): Promise<void> => {
  const persistable: PersistedTimerState = {
    activeTimer: storeState.activeTimer,
    offlineQueue: storeState.offlineQueue,
  };

  try {
    await storage.setItem(TIMER_STORE_STORAGE_KEY, JSON.stringify(persistable));
  } catch (error) {
    console.error('[timerStore] Failed to persist timer state:', error);
  }
};

const setStoreData = (
  partial: Partial<Pick<TimerStoreState, 'activeTimer' | 'localElapsed' | 'isRunning' | 'offlineQueue'>>
): void => {
  if (partial.activeTimer !== undefined) {
    storeState.activeTimer = partial.activeTimer;
  }
  if (partial.localElapsed !== undefined) {
    storeState.localElapsed = partial.localElapsed;
  }
  if (partial.isRunning !== undefined) {
    storeState.isRunning = partial.isRunning;
  }
  if (partial.offlineQueue !== undefined) {
    storeState.offlineQueue = partial.offlineQueue;
  }

  notifyListeners();
  void persistState();
};

const startTickInterval = (): void => {
  if (tickInterval !== null) {
    return;
  }

  tickInterval = setInterval(() => {
    if (!storeState.activeTimer || !storeState.isRunning) {
      return;
    }

    setStoreData({
      localElapsed: calculateElapsedSeconds(storeState.activeTimer),
    });
  }, 1000);
};

const clearTickInterval = (): void => {
  if (tickInterval === null) {
    return;
  }

  clearInterval(tickInterval);
  tickInterval = null;
};

const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(TIMER_STORE_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    const activeTimerCandidate =
      typeof parsed === 'object' && parsed !== null && 'activeTimer' in parsed
        ? (parsed as { activeTimer?: unknown }).activeTimer ?? null
        : null;
    const offlineQueueCandidate =
      typeof parsed === 'object' && parsed !== null && 'offlineQueue' in parsed
        ? (parsed as { offlineQueue?: unknown }).offlineQueue
        : [];

    const activeTimer =
      activeTimerCandidate === null ? null : ActiveTimerSchema.safeParse(activeTimerCandidate).data ?? null;
    const offlineQueue = Array.isArray(offlineQueueCandidate)
      ? offlineQueueCandidate
          .map((item) => QueuedActionSchema.safeParse(item))
          .filter((result) => result.success)
          .map((result) => result.data)
      : [];

    storeState.activeTimer = activeTimer;
    storeState.offlineQueue = offlineQueue;
    storeState.isRunning = Boolean(activeTimer?.running);
    storeState.localElapsed = calculateElapsedSeconds(activeTimer);
    notifyListeners();

    if (storeState.isRunning) {
      startTickInterval();
    }
  } catch (error) {
    console.error('[timerStore] Failed to hydrate timer state:', error);
  }
};

const storeState: TimerStoreState = {
  activeTimer: null,
  localElapsed: 0,
  isRunning: false,
  offlineQueue: [],
  setActiveTimer(timer) {
    const parsed = timer === null ? null : ActiveTimerSchema.parse(timer);
    const shouldRun = Boolean(parsed?.running);

    if (!shouldRun) {
      clearTickInterval();
    }

    setStoreData({
      activeTimer: parsed,
      isRunning: shouldRun,
      localElapsed: calculateElapsedSeconds(parsed),
    });

    if (shouldRun) {
      startTickInterval();
    }
  },
  startLocalTick() {
    if (!storeState.activeTimer) {
      return;
    }

    setStoreData({
      isRunning: true,
      localElapsed: calculateElapsedSeconds(storeState.activeTimer),
    });
    startTickInterval();
  },
  stopLocalTick() {
    clearTickInterval();
    setStoreData({ isRunning: false });
  },
  queueAction(action) {
    const parsed = QueuedActionSchema.parse(action);
    setStoreData({
      offlineQueue: [...storeState.offlineQueue, parsed],
    });
  },
  clearQueue() {
    setStoreData({ offlineQueue: [] });
  },
  syncFromServer(timer) {
    storeState.setActiveTimer(timer);
  },
};

void hydrateStore();

export const getTimerStoreState = (): TimerStoreState => storeState;

export const subscribeTimerStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useTimerStore = <T>(selector: (state: TimerStoreState) => T): T =>
  useSyncExternalStore(
    subscribeTimerStore,
    () => selector(storeState),
    () => selector(storeState)
  );

export type { TimerStoreState };
