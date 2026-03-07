import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';

const THEME_STORE_STORAGE_KEY = 'worktracker.theme-preference.v1';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeStoreState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
};

const storeState: ThemeStoreState = {
  mode: 'dark',
  resolved: 'dark',
};

const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(THEME_STORE_STORAGE_KEY, JSON.stringify({ mode: storeState.mode }));
  } catch (error) {
    console.error('[themeStore] Failed to persist theme state:', error);
  }
};

const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(THEME_STORE_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null && 'mode' in parsed) {
      const mode = (parsed as { mode: unknown }).mode;
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        storeState.mode = mode;
        storeState.resolved = resolveTheme(mode);
        notifyListeners();
      }
    }
  } catch (error) {
    console.error('[themeStore] Failed to hydrate theme state:', error);
  }
};

// Listen for system theme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (storeState.mode === 'system') {
      storeState.resolved = getSystemTheme();
      notifyListeners();
    }
  });
}

void hydrateStore();

export const setThemeMode = (mode: ThemeMode): void => {
  storeState.mode = mode;
  storeState.resolved = resolveTheme(mode);
  notifyListeners();
  void persistState();
};

export const getResolvedTheme = (): ResolvedTheme => storeState.resolved;

export const getThemeStoreState = (): ThemeStoreState => storeState;

export const subscribeThemeStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useThemePreference = <T>(selector: (state: ThemeStoreState) => T): T =>
  useSyncExternalStore(
    subscribeThemeStore,
    () => selector(storeState),
    () => selector(storeState)
  );

export type { ThemeStoreState };
