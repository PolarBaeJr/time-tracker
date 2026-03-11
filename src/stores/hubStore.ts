import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';

const STORAGE_KEY = 'worktracker.hub-layout.v1';

// Widget types - extensible for future phases
export type HubWidgetType = 'timer';

export interface HubWidgetConfig {
  id: string;
  type: HubWidgetType;
  position: number;
  size: 'small' | 'medium' | 'large';
  visible: boolean;
}

interface HubStoreState {
  widgets: HubWidgetConfig[];
  isEditMode: boolean;
}

type Listener = () => void;

// All valid widget types for validation
const ALL_WIDGET_TYPES: HubWidgetType[] = ['timer'];

// Default layout: single TimerWidget at position 0, size 'medium', visible true
const DEFAULT_WIDGETS: HubWidgetConfig[] = [
  {
    id: 'timer-widget-1',
    type: 'timer',
    position: 0,
    size: 'medium',
    visible: true,
  },
];

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const storeState: HubStoreState = {
  widgets: [...DEFAULT_WIDGETS],
  isEditMode: false,
};

const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify({ widgets: storeState.widgets }));
  } catch (error) {
    console.error('[hubStore] Failed to persist state:', error);
  }
};

const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(STORAGE_KEY);
    if (!stored) return;

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null && 'widgets' in parsed) {
      const { widgets } = parsed as { widgets: unknown };
      if (Array.isArray(widgets)) {
        const validated = widgets.filter(
          (w): w is HubWidgetConfig =>
            typeof w === 'object' &&
            w !== null &&
            typeof w.id === 'string' &&
            typeof w.type === 'string' &&
            typeof w.position === 'number' &&
            typeof w.size === 'string' &&
            typeof w.visible === 'boolean' &&
            ALL_WIDGET_TYPES.includes(w.type as HubWidgetType) &&
            ['small', 'medium', 'large'].includes(w.size)
        );

        if (validated.length > 0) {
          // Sort by position to maintain order
          validated.sort((a, b) => a.position - b.position);
          storeState.widgets = validated;
          cachedSnapshot = getSnapshot();
          notifyListeners();
        }
      }
    }
  } catch (error) {
    console.error('[hubStore] Failed to hydrate state:', error);
  }
};

void hydrateStore();

const getSnapshot = (): HubStoreState => ({
  widgets: storeState.widgets,
  isEditMode: storeState.isEditMode,
});

let cachedSnapshot = getSnapshot();

const stableSubscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const wrappedSubscribe = (listener: Listener): (() => void) => {
  return stableSubscribe(() => {
    cachedSnapshot = getSnapshot();
    listener();
  });
};

const getStableSnapshot = (): HubStoreState => {
  return cachedSnapshot;
};

export const setWidgetLayout = (widgets: HubWidgetConfig[]): void => {
  // Validate widget configs
  const validated = widgets.filter(
    w =>
      typeof w.id === 'string' &&
      ALL_WIDGET_TYPES.includes(w.type) &&
      typeof w.position === 'number' &&
      ['small', 'medium', 'large'].includes(w.size) &&
      typeof w.visible === 'boolean'
  );
  storeState.widgets = validated;
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void persistState();
};

export const toggleWidgetVisibility = (id: string): void => {
  storeState.widgets = storeState.widgets.map(w =>
    w.id === id ? { ...w, visible: !w.visible } : w
  );
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void persistState();
};

export const moveWidget = (fromIndex: number, toIndex: number): void => {
  if (fromIndex < 0 || fromIndex >= storeState.widgets.length) return;
  if (toIndex < 0 || toIndex >= storeState.widgets.length) return;

  const newWidgets = [...storeState.widgets];
  const [moved] = newWidgets.splice(fromIndex, 1);
  newWidgets.splice(toIndex, 0, moved);

  // Update positions to reflect new order
  storeState.widgets = newWidgets.map((w, index) => ({ ...w, position: index }));
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void persistState();
};

export const resetToDefault = (): void => {
  storeState.widgets = [...DEFAULT_WIDGETS];
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void persistState();
};

export const setEditMode = (on: boolean): void => {
  storeState.isEditMode = on;
  cachedSnapshot = getSnapshot();
  notifyListeners();
};

export const useHubLayout = (): HubStoreState =>
  useSyncExternalStore(wrappedSubscribe, getStableSnapshot, getStableSnapshot);
