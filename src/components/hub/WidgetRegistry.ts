/**
 * Widget Registry
 *
 * Central registry for Hub widget types and their configuration.
 * This enables extensible widget discovery and configuration
 * while maintaining type safety.
 *
 * Phase 1: Timer widget only
 * Future phases will add: Projects, Goals, Earnings, etc.
 */

import type { IconName } from '@/components/ui';

/**
 * Available widget types in the Hub
 * Add new widget types here as they are implemented
 */
export type WidgetType =
  | 'timer'
  | 'email'
  | 'calendar'
  | 'chat'
  | 'leaderboard'
  | 'activityFeed'
  | 'approval';

/**
 * Widget size variants
 */
export type WidgetSize = 'small' | 'medium' | 'large';

/**
 * Widget configuration interface
 * Defines the static configuration for a widget type
 */
export interface WidgetConfig {
  /** Unique identifier for the widget instance */
  id: string;
  /** Widget type identifier */
  type: WidgetType;
  /** Display title for the widget */
  title: string;
  /** Icon name from the Icon component */
  icon: IconName;
  /** Default size when widget is first added */
  defaultSize: WidgetSize;
  /** Minimum allowed size for the widget */
  minSize: WidgetSize;
  /** Whether the widget can be resized by the user */
  resizable: boolean;
  /** Required auth integration (null = no auth needed) */
  requiresAuth: string | null;
}

/**
 * Widget configuration type without the instance ID
 * Used for defining static widget configs
 */
export type WidgetConfigWithoutId = Omit<WidgetConfig, 'id'>;

/**
 * Registry of all available widget configurations
 * Maps widget type to its configuration
 */
export const WIDGET_CONFIGS: Record<WidgetType, WidgetConfigWithoutId> = {
  timer: {
    type: 'timer',
    title: 'Timer',
    icon: 'time',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: null,
  },
  email: {
    type: 'email',
    title: 'Email',
    icon: 'mail',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: 'gmail',
  },
  calendar: {
    type: 'calendar',
    title: 'Calendar',
    icon: 'calendar',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: 'google_calendar',
  },
  chat: {
    type: 'chat',
    title: 'AI Assistant',
    icon: 'chat-bubble',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: null, // Chat works without external auth
  },
  leaderboard: {
    type: 'leaderboard',
    title: 'Leaderboard',
    icon: 'bar-chart',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: null, // Requires workspace membership (RLS enforced)
  },
  activityFeed: {
    type: 'activityFeed',
    title: 'Activity',
    icon: 'activity',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: null, // Requires workspace membership (RLS enforced)
  },
  approval: {
    type: 'approval',
    title: 'Approvals',
    icon: 'checkmark-circle',
    defaultSize: 'medium',
    minSize: 'small',
    resizable: true,
    requiresAuth: null, // Requires workspace membership (RLS enforced)
  },
};

/**
 * Get the configuration for a specific widget type
 *
 * @param type - The widget type to look up
 * @returns The widget configuration for the given type
 * @throws Error if the widget type is not registered
 */
export function getWidgetConfig(type: WidgetType): WidgetConfigWithoutId {
  const config = WIDGET_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown widget type: ${type}`);
  }
  return config;
}

/**
 * Get all registered widget types
 *
 * @returns Array of all available widget types
 */
export function getRegisteredWidgetTypes(): WidgetType[] {
  return Object.keys(WIDGET_CONFIGS) as WidgetType[];
}

/**
 * Check if a string is a valid widget type
 *
 * @param type - The string to check
 * @returns True if the type is a valid WidgetType
 */
export function isValidWidgetType(type: string): type is WidgetType {
  return type in WIDGET_CONFIGS;
}
