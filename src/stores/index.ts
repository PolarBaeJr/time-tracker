/**
 * Stores barrel export
 */

export { getTimerStoreState, subscribeTimerStore, useTimerStore } from './timerStore';
export type { TimerStoreState } from './timerStore';

export {
  setThemeMode,
  getResolvedTheme,
  getThemeStoreState,
  subscribeThemeStore,
  useThemePreference,
} from './themeStore';
export type { ThemeStoreState, ThemeMode, ResolvedTheme } from './themeStore';

export {
  updateTimerSettings,
  addQuickPreset,
  removeQuickPreset,
  getTimerSettingsState,
  subscribeTimerSettings,
  useTimerSettings,
} from './timerSettingsStore';
export type { TimerSettings, QuickPreset } from './timerSettingsStore';

// @deprecated - Use useEntryTemplatesQuery and mutation hooks from '@/hooks/useEntryTemplates' instead.
// Kept for backward compatibility during migration.
export {
  addTemplate,
  updateTemplate,
  removeTemplate,
  getTemplateStoreState,
  subscribeTemplateStore,
  useEntryTemplates,
  getLocalTemplatesAndClear,
} from './entryTemplateStore';
export type { EntryTemplate, TemplateStoreState } from './entryTemplateStore';

export {
  useDashboardLayout,
  setWidgetOrder,
  toggleWidgetVisibility,
  moveWidget,
  resetToDefault,
  setEditMode,
  getDashboardForSync,
  applyServerDashboardPrefs,
} from './dashboardStore';
export type { DashboardWidgetId, DashboardWidgetConfig } from './dashboardStore';

export {
  ACCENT_PRESETS,
  setAccentColor,
  getAccentColor,
  subscribeAccentStore,
  useAccentColor,
} from './accentStore';
export type { AccentStoreState } from './accentStore';

export {
  useHubLayout,
  setWidgetLayout,
  toggleWidgetVisibility as toggleHubWidgetVisibility,
  moveWidget as moveHubWidget,
  resetToDefault as resetHubLayout,
  setEditMode as setHubEditMode,
} from './hubStore';
export type { HubWidgetType, HubWidgetConfig } from './hubStore';

export {
  updateUXSettings,
  setAnimationsEnabled,
  setHapticFeedbackEnabled,
  setSoundEnabled,
  setSoundVolume,
  setSoundPreset,
  syncReducedMotion,
  getUXSettingsState,
  subscribeUXSettings,
  useUXSettings,
  useUXSettingsSelector,
} from './uxSettingsStore';
export type { UXSettings, UpdateUXSettingsInput, SoundPreset } from './uxSettingsStore';
