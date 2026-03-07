import { useSyncExternalStore, useCallback } from 'react';

import { storage } from '@/lib';

const STORAGE_KEY = 'worktracker.pomodoro-settings.v1';

export interface PomodoroSettingsData {
  pomodoroEnabled: boolean;
  workDurationSeconds: number;
  breakDurationSeconds: number;
  longBreakDurationSeconds: number;
  pomodorosBeforeLongBreak: number;
}

const DEFAULT_SETTINGS: PomodoroSettingsData = {
  pomodoroEnabled: false,
  workDurationSeconds: 25 * 60,
  breakDurationSeconds: 5 * 60,
  longBreakDurationSeconds: 15 * 60,
  pomodorosBeforeLongBreak: 4,
};

type Listener = () => void;

const listeners = new Set<Listener>();
let currentSettings: PomodoroSettingsData = { ...DEFAULT_SETTINGS };
let isLoaded = false;

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const persistSettings = async (): Promise<void> => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (error) {
    console.error('[pomodoroSettings] Failed to persist settings:', error);
  }
};

const hydrateSettings = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        currentSettings = {
          pomodoroEnabled:
            typeof obj.pomodoroEnabled === 'boolean'
              ? obj.pomodoroEnabled
              : DEFAULT_SETTINGS.pomodoroEnabled,
          workDurationSeconds:
            typeof obj.workDurationSeconds === 'number'
              ? obj.workDurationSeconds
              : DEFAULT_SETTINGS.workDurationSeconds,
          breakDurationSeconds:
            typeof obj.breakDurationSeconds === 'number'
              ? obj.breakDurationSeconds
              : DEFAULT_SETTINGS.breakDurationSeconds,
          longBreakDurationSeconds:
            typeof obj.longBreakDurationSeconds === 'number'
              ? obj.longBreakDurationSeconds
              : DEFAULT_SETTINGS.longBreakDurationSeconds,
          pomodorosBeforeLongBreak:
            typeof obj.pomodorosBeforeLongBreak === 'number'
              ? obj.pomodorosBeforeLongBreak
              : DEFAULT_SETTINGS.pomodorosBeforeLongBreak,
        };
      }
    }
  } catch (error) {
    console.error('[pomodoroSettings] Failed to hydrate settings:', error);
  } finally {
    isLoaded = true;
    notifyListeners();
  }
};

void hydrateSettings();

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): { settings: PomodoroSettingsData; isLoaded: boolean } => ({
  settings: currentSettings,
  isLoaded,
});

let cachedSnapshot = getSnapshot();

const getStableSnapshot = (): { settings: PomodoroSettingsData; isLoaded: boolean } => {
  const next = getSnapshot();
  if (next.isLoaded !== cachedSnapshot.isLoaded || next.settings !== cachedSnapshot.settings) {
    cachedSnapshot = next;
  }
  return cachedSnapshot;
};

const stableSubscribe = (listener: Listener): (() => void) => {
  return subscribe(() => {
    cachedSnapshot = getSnapshot();
    listener();
  });
};

export interface UsePomodoroSettingsResult {
  settings: PomodoroSettingsData;
  updateSettings: (partial: Partial<PomodoroSettingsData>) => void;
  isLoaded: boolean;
}

export function usePomodoroSettings(): UsePomodoroSettingsResult {
  const snapshot = useSyncExternalStore(stableSubscribe, getStableSnapshot, getStableSnapshot);

  const updateSettings = useCallback((partial: Partial<PomodoroSettingsData>) => {
    currentSettings = { ...currentSettings, ...partial };
    notifyListeners();
    void persistSettings();
  }, []);

  return {
    settings: snapshot.settings,
    updateSettings,
    isLoaded: snapshot.isLoaded,
  };
}
