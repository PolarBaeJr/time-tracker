import { useSyncExternalStore, useCallback } from 'react';

import { storage } from '@/lib';

const STORAGE_KEY = 'worktracker.pomodoro-settings.v1';
const PRESETS_STORAGE_KEY = 'worktracker.pomodoro-presets.v1';

export interface PomodoroSettingsData {
  pomodoroEnabled: boolean;
  workDurationSeconds: number;
  breakDurationSeconds: number;
  longBreakDurationSeconds: number;
  pomodorosBeforeLongBreak: number;
}

export interface PomodoroPreset {
  id: string;
  name: string;
  builtIn?: boolean;
  settings: Omit<PomodoroSettingsData, 'pomodoroEnabled'>;
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

let syncToServer: ((prefs: Record<string, unknown>) => void) | null = null;

export function setSyncCallback(cb: ((prefs: Record<string, unknown>) => void) | null): void {
  syncToServer = cb;
}

const persistSettings = async (): Promise<void> => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    if (syncToServer) {
      syncToServer(getSettingsForSync());
    }
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

// --- Preset store ---

const BUILT_IN_PRESETS: PomodoroPreset[] = [
  {
    id: 'builtin-standard',
    name: 'Standard (25/5)',
    builtIn: true,
    settings: {
      workDurationSeconds: 25 * 60,
      breakDurationSeconds: 5 * 60,
      longBreakDurationSeconds: 15 * 60,
      pomodorosBeforeLongBreak: 4,
    },
  },
  {
    id: 'builtin-long-focus',
    name: 'Long Focus (50/10)',
    builtIn: true,
    settings: {
      workDurationSeconds: 50 * 60,
      breakDurationSeconds: 10 * 60,
      longBreakDurationSeconds: 30 * 60,
      pomodorosBeforeLongBreak: 4,
    },
  },
  {
    id: 'builtin-short-sprint',
    name: 'Short Sprint (15/3)',
    builtIn: true,
    settings: {
      workDurationSeconds: 15 * 60,
      breakDurationSeconds: 3 * 60,
      longBreakDurationSeconds: 10 * 60,
      pomodorosBeforeLongBreak: 4,
    },
  },
];

let customPresets: PomodoroPreset[] = [];
let presetsLoaded = false;

const presetListeners = new Set<Listener>();

const notifyPresetListeners = (): void => {
  presetListeners.forEach(listener => listener());
};

const persistPresets = async (): Promise<void> => {
  try {
    await storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets));
    if (syncToServer) {
      syncToServer(getSettingsForSync());
    }
  } catch (error) {
    console.error('[pomodoroSettings] Failed to persist presets:', error);
  }
};

const hydratePresets = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(PRESETS_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        customPresets = parsed.filter(
          (p): p is PomodoroPreset =>
            typeof p === 'object' &&
            p !== null &&
            typeof p.id === 'string' &&
            typeof p.name === 'string' &&
            typeof p.settings === 'object' &&
            p.settings !== null
        );
      }
    }
  } catch (error) {
    console.error('[pomodoroSettings] Failed to hydrate presets:', error);
  } finally {
    presetsLoaded = true;
    rebuildPresets();
    cachedPresetSnapshot = { presets: allPresets, isLoaded: presetsLoaded };
    notifyPresetListeners();
  }
};

void hydratePresets();

let allPresets: PomodoroPreset[] = [...BUILT_IN_PRESETS, ...customPresets];

const rebuildPresets = (): void => {
  allPresets = [...BUILT_IN_PRESETS, ...customPresets];
};

let cachedPresetSnapshot = { presets: allPresets, isLoaded: presetsLoaded };

const getPresetSnapshot = (): { presets: PomodoroPreset[]; isLoaded: boolean } => {
  return cachedPresetSnapshot;
};

const stablePresetSubscribe = (listener: Listener): (() => void) => {
  presetListeners.add(listener);
  return () => {
    presetListeners.delete(listener);
  };
};

const wrappedPresetSubscribe = (listener: Listener): (() => void) => {
  return stablePresetSubscribe(() => {
    listener();
  });
};

export function savePreset(
  name: string,
  settings: Omit<PomodoroSettingsData, 'pomodoroEnabled'>
): PomodoroPreset {
  const preset: PomodoroPreset = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    settings: { ...settings },
  };
  customPresets = [...customPresets, preset];
  rebuildPresets();
  cachedPresetSnapshot = { presets: allPresets, isLoaded: presetsLoaded };
  notifyPresetListeners();
  void persistPresets();
  return preset;
}

export function deletePreset(id: string): void {
  const target = customPresets.find(p => p.id === id);
  if (!target) return;
  customPresets = customPresets.filter(p => p.id !== id);
  rebuildPresets();
  cachedPresetSnapshot = { presets: allPresets, isLoaded: presetsLoaded };
  notifyPresetListeners();
  void persistPresets();
}

export function applyServerPreferences(prefs: {
  pomodoroEnabled?: boolean;
  workDurationSeconds?: number;
  breakDurationSeconds?: number;
  longBreakDurationSeconds?: number;
  pomodorosBeforeLongBreak?: number;
  customPresets?: PomodoroPreset[];
}): void {
  if (!prefs || typeof prefs !== 'object') return;

  const updates: Partial<PomodoroSettingsData> = {};
  if (typeof prefs.pomodoroEnabled === 'boolean') updates.pomodoroEnabled = prefs.pomodoroEnabled;
  if (typeof prefs.workDurationSeconds === 'number')
    updates.workDurationSeconds = prefs.workDurationSeconds;
  if (typeof prefs.breakDurationSeconds === 'number')
    updates.breakDurationSeconds = prefs.breakDurationSeconds;
  if (typeof prefs.longBreakDurationSeconds === 'number')
    updates.longBreakDurationSeconds = prefs.longBreakDurationSeconds;
  if (typeof prefs.pomodorosBeforeLongBreak === 'number')
    updates.pomodorosBeforeLongBreak = prefs.pomodorosBeforeLongBreak;

  if (Object.keys(updates).length > 0) {
    currentSettings = { ...currentSettings, ...updates };
    cachedSnapshot = getSnapshot();
    notifyListeners();
    void storage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  }

  if (Array.isArray(prefs.customPresets)) {
    customPresets = prefs.customPresets.filter(
      (p): p is PomodoroPreset =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.settings === 'object' &&
        p.settings !== null
    );
    rebuildPresets();
    cachedPresetSnapshot = { presets: allPresets, isLoaded: presetsLoaded };
    notifyPresetListeners();
    void storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets));
  }
}

export function getSettingsForSync(): Record<string, unknown> {
  return {
    pomodoroEnabled: currentSettings.pomodoroEnabled,
    workDurationSeconds: currentSettings.workDurationSeconds,
    breakDurationSeconds: currentSettings.breakDurationSeconds,
    longBreakDurationSeconds: currentSettings.longBreakDurationSeconds,
    pomodorosBeforeLongBreak: currentSettings.pomodorosBeforeLongBreak,
    customPresets: customPresets,
  };
}

export interface UsePomodoroSettingsResult {
  settings: PomodoroSettingsData;
  updateSettings: (partial: Partial<PomodoroSettingsData>) => void;
  isLoaded: boolean;
}

export interface UsePomodoroPresetsResult {
  presets: PomodoroPreset[];
  savePreset: (
    name: string,
    settings: Omit<PomodoroSettingsData, 'pomodoroEnabled'>
  ) => PomodoroPreset;
  deletePreset: (id: string) => void;
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

export function usePomodoroPresets(): UsePomodoroPresetsResult {
  const snapshot = useSyncExternalStore(
    wrappedPresetSubscribe,
    getPresetSnapshot,
    getPresetSnapshot
  );

  const save = useCallback(
    (name: string, settings: Omit<PomodoroSettingsData, 'pomodoroEnabled'>) => {
      return savePreset(name, settings);
    },
    []
  );

  const remove = useCallback((id: string) => {
    deletePreset(id);
  }, []);

  return {
    presets: snapshot.presets,
    savePreset: save,
    deletePreset: remove,
    isLoaded: snapshot.isLoaded,
  };
}
