import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';

const TIMER_SETTINGS_STORAGE_KEY = 'worktracker.timer-settings.v1';

interface QuickPreset {
  id: string;
  name: string;
  timerMode: 'normal' | 'pomodoro' | 'countdown';
  categoryId: string | null;
  durationSeconds: number | null;
}

interface TimerSettings {
  soundEnabled: boolean;
  soundVolume: number;
  selectedSound: string;
  idleDetectionEnabled: boolean;
  idleThresholdMinutes: number;
  quickPresets: QuickPreset[];
}

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const DEFAULT_SETTINGS: TimerSettings = {
  soundEnabled: false,
  soundVolume: 0.7,
  selectedSound: 'default',
  idleDetectionEnabled: false,
  idleThresholdMinutes: 15,
  quickPresets: [],
};

let settings: TimerSettings = { ...DEFAULT_SETTINGS };

const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(TIMER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[timerSettingsStore] Failed to persist settings:', error);
  }
};

const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(TIMER_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }

    const data = parsed as Record<string, unknown>;

    settings = {
      soundEnabled:
        typeof data.soundEnabled === 'boolean' ? data.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      soundVolume:
        typeof data.soundVolume === 'number' ? data.soundVolume : DEFAULT_SETTINGS.soundVolume,
      selectedSound:
        typeof data.selectedSound === 'string'
          ? data.selectedSound
          : DEFAULT_SETTINGS.selectedSound,
      idleDetectionEnabled:
        typeof data.idleDetectionEnabled === 'boolean'
          ? data.idleDetectionEnabled
          : DEFAULT_SETTINGS.idleDetectionEnabled,
      idleThresholdMinutes:
        typeof data.idleThresholdMinutes === 'number'
          ? data.idleThresholdMinutes
          : DEFAULT_SETTINGS.idleThresholdMinutes,
      quickPresets: Array.isArray(data.quickPresets)
        ? data.quickPresets
        : DEFAULT_SETTINGS.quickPresets,
    };

    notifyListeners();
  } catch (error) {
    console.error('[timerSettingsStore] Failed to hydrate settings:', error);
  }
};

void hydrateStore();

export const updateTimerSettings = (partial: Partial<TimerSettings>): void => {
  settings = { ...settings, ...partial };
  notifyListeners();
  void persistState();
};

export const addQuickPreset = (preset: QuickPreset): void => {
  settings = { ...settings, quickPresets: [...settings.quickPresets, preset] };
  notifyListeners();
  void persistState();
};

export const removeQuickPreset = (id: string): void => {
  settings = { ...settings, quickPresets: settings.quickPresets.filter(p => p.id !== id) };
  notifyListeners();
  void persistState();
};

export const getTimerSettingsState = (): TimerSettings => settings;

export const subscribeTimerSettings = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useTimerSettings = (): TimerSettings =>
  useSyncExternalStore(
    subscribeTimerSettings,
    () => settings,
    () => settings
  );

export type { TimerSettings, QuickPreset };
