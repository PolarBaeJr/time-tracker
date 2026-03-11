import { useMemo, useCallback } from 'react';

import {
  useHubLayout,
  toggleWidgetVisibility as storeToggleVisibility,
  moveWidget as storeMoveWidget,
  resetToDefault as storeResetToDefault,
  setEditMode as storeSetEditMode,
  type HubWidgetConfig,
} from '@/stores/hubStore';

/**
 * Return type for useWidgetLayout hook
 */
export interface UseWidgetLayoutResult {
  /** All widgets in layout order */
  widgets: HubWidgetConfig[];
  /** Only visible widgets */
  visibleWidgets: HubWidgetConfig[];
  /** Whether edit mode is active */
  isEditMode: boolean;
  /** Toggle visibility of a widget by id */
  toggleVisibility: (id: string) => void;
  /** Move widget from one position to another */
  moveWidget: (fromIndex: number, toIndex: number) => void;
  /** Reset layout to default configuration */
  resetLayout: () => void;
  /** Set edit mode on/off */
  setEditMode: (on: boolean) => void;
}

/**
 * Hook for managing widget layout in the Hub screen.
 * Wraps hubStore with memoized selectors and stable action handlers.
 *
 * @example
 * ```tsx
 * const { visibleWidgets, isEditMode, toggleVisibility } = useWidgetLayout();
 *
 * return (
 *   <WidgetGrid
 *     widgets={visibleWidgets}
 *     editMode={isEditMode}
 *     renderWidget={(widget) => <TimerWidget key={widget.id} />}
 *   />
 * );
 * ```
 */
export function useWidgetLayout(): UseWidgetLayoutResult {
  const { widgets, isEditMode } = useHubLayout();

  // Memoize visible widgets filter
  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible), [widgets]);

  // Stable callback refs
  const toggleVisibility = useCallback((id: string) => {
    storeToggleVisibility(id);
  }, []);

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    storeMoveWidget(fromIndex, toIndex);
  }, []);

  const resetLayout = useCallback(() => {
    storeResetToDefault();
  }, []);

  const setEditMode = useCallback((on: boolean) => {
    storeSetEditMode(on);
  }, []);

  return {
    widgets,
    visibleWidgets,
    isEditMode,
    toggleVisibility,
    moveWidget,
    resetLayout,
    setEditMode,
  };
}
