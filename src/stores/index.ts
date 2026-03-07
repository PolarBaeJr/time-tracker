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

export {
  addTemplate,
  updateTemplate,
  removeTemplate,
  getTemplateStoreState,
  subscribeTemplateStore,
  useEntryTemplates,
} from './entryTemplateStore';
export type { EntryTemplate, TemplateStoreState } from './entryTemplateStore';
