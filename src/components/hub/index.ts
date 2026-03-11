/**
 * Hub Components Barrel Export
 *
 * Re-exports all hub-related components, types, and utilities
 * for clean imports via '@/components/hub'
 */

// WidgetCard component and types
export { WidgetCard, type WidgetCardProps } from './WidgetCard';

// WidgetGrid component and types
export { WidgetGrid, type WidgetGridProps } from './WidgetGrid';

// WidgetRegistry types and utilities
export {
  type WidgetType,
  type WidgetSize,
  type WidgetConfig,
  type WidgetConfigWithoutId,
  WIDGET_CONFIGS,
  getWidgetConfig,
  getRegisteredWidgetTypes,
  isValidWidgetType,
} from './WidgetRegistry';

// Widget components
export { TimerWidget, type TimerWidgetProps } from './widgets/TimerWidget';
