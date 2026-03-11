import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';

const ACCENT_STORE_STORAGE_KEY = 'worktracker.accent-color.v1';

const DEFAULT_ACCENT = '#6366F1';

export const ACCENT_PRESETS = [
  { name: 'Indigo', primary: '#6366F1' },
  { name: 'Blue', primary: '#276EF1' },
  { name: 'Purple', primary: '#7B61FF' },
  { name: 'Red', primary: '#E94560' },
  { name: 'Green', primary: '#00C853' },
  { name: 'Orange', primary: '#FF6D00' },
  { name: 'Pink', primary: '#FF4081' },
  { name: 'Teal', primary: '#00BCD4' },
] as const;

interface AccentStoreState {
  accentColor: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const storeState: AccentStoreState = {
  accentColor: DEFAULT_ACCENT,
};

const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(ACCENT_STORE_STORAGE_KEY, JSON.stringify({ accentColor: storeState.accentColor }));
  } catch (error) {
    console.error('[accentStore] Failed to persist accent state:', error);
  }
};

const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(ACCENT_STORE_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null && 'accentColor' in parsed) {
      const accentColor = (parsed as { accentColor: unknown }).accentColor;
      if (typeof accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
        storeState.accentColor = accentColor;
        notifyListeners();
      }
    }
  } catch (error) {
    console.error('[accentStore] Failed to hydrate accent state:', error);
  }
};

void hydrateStore();

export const setAccentColor = (hex: string): void => {
  storeState.accentColor = hex;
  notifyListeners();
  void persistState();
};

export const getAccentColor = (): string => storeState.accentColor;

export const subscribeAccentStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useAccentColor = (): string =>
  useSyncExternalStore(
    subscribeAccentStore,
    () => storeState.accentColor,
    () => storeState.accentColor
  );

export type { AccentStoreState };
