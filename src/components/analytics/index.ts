/**
 * Analytics Components Module
 *
 * Components for the analytics dashboard including KPI cards
 * and goal progress displays.
 *
 * USAGE:
 * ```typescript
 * import { KPICards, GoalProgress, getCurrentMonth } from '@/components/analytics';
 * ```
 */

export { KPICards } from './KPICards';
export type { KPICardsProps } from './KPICards';

export { GoalProgress, getCurrentMonth } from './GoalProgress';
export type { GoalProgressProps } from './GoalProgress';

export { PomodoroStats } from './PomodoroStats';
export type { PomodoroStatsProps } from './PomodoroStats';

export { DashboardWidgetWrapper } from './DashboardWidgetWrapper';
export { DashboardEditPanel } from './DashboardEditPanel';
