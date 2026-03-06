/**
 * ChartContainer Component
 *
 * A wrapper component for charts that handles loading state, error boundaries,
 * and empty data states. All charts should be wrapped with this component.
 *
 * USAGE:
 * ```typescript
 * import { ChartContainer } from '@/components/charts';
 *
 * function MyChart() {
 *   const { data, isLoading, error } = useDailyTotals();
 *
 *   return (
 *     <ChartContainer
 *       isLoading={isLoading}
 *       error={error}
 *       isEmpty={!data?.length}
 *       title="Daily Activity"
 *     >
 *       <DailyChart data={data} />
 *     </ChartContainer>
 *   );
 * }
 * ```
 */

import React, { Component, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import { Text, Spinner, Card } from '@/components/ui';
import { colors, spacing } from '@/theme';

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

/**
 * Error boundary specifically for chart components
 * Catches rendering errors and displays a fallback UI
 */
class ChartErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
    // Log to console in development
    if (__DEV__) {
      console.error('Chart rendering error:', error);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.errorContainer}>
          <Text variant="bodySmall" color="error">
            Failed to render chart
          </Text>
          {__DEV__ && this.state.error && (
            <Text variant="caption" color="muted" style={styles.errorDetails}>
              {this.state.error.message}
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// CHART CONTAINER
// ============================================================================

export interface ChartContainerProps {
  /** Chart content to render */
  children: ReactNode;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error object if fetch failed */
  error?: Error | null;
  /** Whether the data is empty */
  isEmpty?: boolean;
  /** Chart title */
  title?: string;
  /** Chart subtitle/description */
  subtitle?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom loading message */
  loadingMessage?: string;
  /** Minimum height for the chart area */
  minHeight?: number;
  /** Additional styles for the container */
  style?: ViewStyle;
  /** Whether to show as a card */
  showCard?: boolean;
  /** Callback when error boundary catches an error */
  onRenderError?: (error: Error) => void;
}

/**
 * Container wrapper for all chart components
 *
 * Handles:
 * - Loading state with spinner
 * - Error state with retry option
 * - Empty data state
 * - Error boundary for rendering failures
 * - Consistent styling and layout
 */
export function ChartContainer({
  children,
  isLoading = false,
  error = null,
  isEmpty = false,
  title,
  subtitle,
  emptyMessage = 'No data available',
  loadingMessage = 'Loading chart...',
  minHeight = 200,
  style,
  showCard = true,
  onRenderError,
}: ChartContainerProps): React.ReactElement {
  // Render content based on state
  const renderContent = (): React.ReactElement => {
    // Loading state
    if (isLoading) {
      return (
        <View style={[styles.stateContainer, { minHeight }]}>
          <Spinner message={loadingMessage} />
        </View>
      );
    }

    // Error state
    if (error) {
      return (
        <View style={[styles.stateContainer, { minHeight }]}>
          <Text variant="bodySmall" color="error" center>
            Failed to load chart data
          </Text>
          <Text variant="caption" color="muted" center style={styles.errorMessage}>
            {error.message || 'An unexpected error occurred'}
          </Text>
        </View>
      );
    }

    // Empty state
    if (isEmpty) {
      return (
        <View style={[styles.stateContainer, { minHeight }]}>
          <Text variant="body" color="muted" center>
            {emptyMessage}
          </Text>
          <Text variant="caption" color="muted" center style={styles.emptyHint}>
            Start tracking time to see your analytics
          </Text>
        </View>
      );
    }

    // Chart content
    return (
      <ChartErrorBoundary onError={onRenderError}>
        <View style={[styles.chartArea, { minHeight }]}>{children}</View>
      </ChartErrorBoundary>
    );
  };

  const content = (
    <>
      {/* Header */}
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && (
            <Text variant="headingSmall" style={styles.title}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text variant="caption" color="muted">
              {subtitle}
            </Text>
          )}
        </View>
      )}

      {/* Chart content */}
      {renderContent()}
    </>
  );

  if (showCard) {
    return (
      <Card padding="md" style={style ? { ...styles.container, ...style } : styles.container}>
        {content}
      </Card>
    );
  }

  return <View style={[styles.container, style]}>{content}</View>;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  stateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  chartArea: {
    width: '100%',
  },
  errorContainer: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
  },
  errorDetails: {
    marginTop: spacing.xs,
  },
  errorMessage: {
    marginTop: spacing.sm,
  },
  emptyHint: {
    marginTop: spacing.sm,
  },
});

export default ChartContainer;
