import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';

const TEMPLATE_STORAGE_KEY = 'worktracker.entry-templates.v1';

interface EntryTemplate {
  id: string;
  name: string;
  categoryId: string | null;
  notes: string;
  durationSeconds: number;
  isBillable: boolean;
  tagIds: string[];
}

interface TemplateStoreState {
  templates: EntryTemplate[];
}

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

const DEFAULT_STATE: TemplateStoreState = {
  templates: [],
};

let state: TemplateStoreState = { ...DEFAULT_STATE };

const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[entryTemplateStore] Failed to persist state:', error);
  }
};

const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }

    const data = parsed as Record<string, unknown>;

    state = {
      templates: Array.isArray(data.templates) ? data.templates : DEFAULT_STATE.templates,
    };

    notifyListeners();
  } catch (error) {
    console.error('[entryTemplateStore] Failed to hydrate state:', error);
  }
};

void hydrateStore();

export const addTemplate = (template: Omit<EntryTemplate, 'id'>): EntryTemplate => {
  const newTemplate: EntryTemplate = {
    ...template,
    id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  state = { ...state, templates: [...state.templates, newTemplate] };
  notifyListeners();
  void persistState();
  return newTemplate;
};

export const updateTemplate = (id: string, partial: Partial<Omit<EntryTemplate, 'id'>>): void => {
  state = {
    ...state,
    templates: state.templates.map(t => (t.id === id ? { ...t, ...partial } : t)),
  };
  notifyListeners();
  void persistState();
};

export const removeTemplate = (id: string): void => {
  state = { ...state, templates: state.templates.filter(t => t.id !== id) };
  notifyListeners();
  void persistState();
};

export const getTemplateStoreState = (): TemplateStoreState => state;

export const subscribeTemplateStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useEntryTemplates = (): EntryTemplate[] =>
  useSyncExternalStore(
    subscribeTemplateStore,
    () => state.templates,
    () => state.templates
  );

export type { EntryTemplate, TemplateStoreState };
