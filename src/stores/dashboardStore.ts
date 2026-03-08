import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';

const STORAGE_KEY = 'worktracker.dashboard-layout.v1';

export type DashboardWidgetId =
  | 'kpi'
  | 'pomodoro'
  | 'goals'
  | 'daily-chart'
  | 'weekly-chart'
  | 'monthly-chart'
  | 'earnings-chart'
  | 'heatmap';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  visible: boolean;
}

interface DashboardStoreState {
  widgets: DashboardWidgetConfig[];
  isEditMode: boolean;
}

type Listener = () => void;

const ALL_WIDGET_IDS: DashboardWidgetId[] = [
  'kpi',
  'pomodoro',
  'goals',
  'daily-chart',
  'weekly-chart',
  'monthly-chart',
  'earnings-chart',
  'heatmap',
];

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = ALL_WIDGET_IDS.map(id => ({
  id,
  visible: true,
}));

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const storeState: DashboardStoreState = {
  widgets: [...DEFAULT_WIDGETS],
  isEditMode: false,
};

const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify({ widgets: storeState.widgets }));
  } catch (error) {
    console.error('[dashboardStore] Failed to persist state:', error);
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
          (w): w is DashboardWidgetConfig =>
            typeof w === 'object' &&
            w !== null &&
            typeof w.id === 'string' &&
            typeof w.visible === 'boolean' &&
            ALL_WIDGET_IDS.includes(w.id as DashboardWidgetId)
        );

        // Append any missing widget IDs (handles future additions)
        const existingIds = new Set(validated.map(w => w.id));
        const missing = ALL_WIDGET_IDS.filter(id => !existingIds.has(id)).map(id => ({
          id,
          visible: true,
        }));

        storeState.widgets = [...validated, ...missing];
        cachedSnapshot = getSnapshot();
        notifyListeners();
      }
    }
  } catch (error) {
    console.error('[dashboardStore] Failed to hydrate state:', error);
  }
};

void hydrateStore();

const getSnapshot = (): DashboardStoreState => ({
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

const getStableSnapshot = (): DashboardStoreState => {
  return cachedSnapshot;
};

export const setWidgetOrder = (widgets: DashboardWidgetConfig[]): void => {
  storeState.widgets = widgets;
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void persistState();
};

export const toggleWidgetVisibility = (id: DashboardWidgetId): void => {
  storeState.widgets = storeState.widgets.map(w =>
    w.id === id ? { ...w, visible: !w.visible } : w
  );
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void persistState();
};

export const moveWidget = (fromIndex: number, toIndex: number): void => {
  const newWidgets = [...storeState.widgets];
  const [moved] = newWidgets.splice(fromIndex, 1);
  newWidgets.splice(toIndex, 0, moved);
  storeState.widgets = newWidgets;
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

export const getDashboardForSync = (): { dashboardWidgets: DashboardWidgetConfig[] } => ({
  dashboardWidgets: storeState.widgets,
});

export const applyServerDashboardPrefs = (
  widgets: Array<{ id: string; visible: boolean }>
): void => {
  if (!Array.isArray(widgets)) return;

  const validated = widgets.filter(
    (w): w is DashboardWidgetConfig =>
      typeof w === 'object' &&
      w !== null &&
      typeof w.id === 'string' &&
      typeof w.visible === 'boolean' &&
      ALL_WIDGET_IDS.includes(w.id as DashboardWidgetId)
  );

  // Append missing widget IDs
  const existingIds = new Set(validated.map(w => w.id));
  const missing = ALL_WIDGET_IDS.filter(id => !existingIds.has(id)).map(id => ({
    id,
    visible: true,
  }));

  storeState.widgets = [...validated, ...missing];
  cachedSnapshot = getSnapshot();
  notifyListeners();
  void storage.setItem(STORAGE_KEY, JSON.stringify({ widgets: storeState.widgets }));
};

export const useDashboardLayout = (): DashboardStoreState =>
  useSyncExternalStore(wrappedSubscribe, getStableSnapshot, getStableSnapshot);
