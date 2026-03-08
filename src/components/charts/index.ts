/**
 * Charts Module
 *
 * Victory Native chart components for visualizing time tracking analytics.
 * All charts are designed to work with data from the useAnalytics hooks.
 *
 * USAGE:
 * ```typescript
 * import {
 *   ChartContainer,
 *   DailyChart,
 *   WeeklyChart,
 *   MonthlyChart,
 *   HeatmapChart,
 * } from '@/components/charts';
 * ```
 *
 * REQUIRES: victory-native, react-native-svg
 * Install: npx expo install victory-native react-native-svg
 */

// Container component
export { ChartContainer } from './ChartContainer';
export type { ChartContainerProps } from './ChartContainer';

// Bar charts
export { DailyChart } from './DailyChart';
export type { DailyChartProps } from './DailyChart';

export { WeeklyChart } from './WeeklyChart';
export type { WeeklyChartProps } from './WeeklyChart';

export { MonthlyChart } from './MonthlyChart';
export type { MonthlyChartProps } from './MonthlyChart';

// Earnings chart
export { EarningsChart } from './EarningsChart';
export type { EarningsChartProps } from './EarningsChart';

// Heatmap chart
export { HeatmapChart } from './HeatmapChart';
export type { HeatmapChartProps } from './HeatmapChart';
