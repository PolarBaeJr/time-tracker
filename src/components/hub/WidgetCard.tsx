/**
 * WidgetCard Component
 *
 * Base card component for Hub widgets with consistent styling,
 * header layout, loading states, and error handling.
 * Follows Uber-style design with 16px border radius and subtle shadows.
 */

import * as React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, Icon, Spinner, Text, type IconName } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import type { WidgetSize } from './WidgetRegistry';

/**
 * WidgetCard component props
 */
export interface WidgetCardProps {
  /** Widget content */
  children: React.ReactNode;
  /** Widget title displayed in header */
  title: string;
  /** Optional icon displayed before title */
  icon?: IconName;
  /** Widget size affects padding and layout */
  size: WidgetSize;
  /** Callback when expand button is pressed */
  onExpand?: () => void;
  /** Callback when configure button is pressed */
  onConfigure?: () => void;
  /** Whether widget is in loading state */
  loading?: boolean;
  /** Error to display (replaces children with error message) */
  error?: Error | null;
  /** Additional styles for the card */
  style?: ViewStyle;
}

/**
 * Padding values based on widget size
 */
const sizePadding: Record<WidgetSize, number> = {
  small: 8,
  medium: 12,
  large: 16,
};

/**
 * WidgetCard Component
 *
 * Renders a card with a header row containing icon, title, and optional actions.
 * Content is wrapped in ErrorBoundary for graceful error handling.
 * Shows spinner when loading, error message when error is set.
 */
export function WidgetCard({
  children,
  title,
  icon,
  size,
  onExpand,
  onConfigure,
  loading = false,
  error = null,
  style,
}: WidgetCardProps): React.ReactElement {
  const { colors } = useTheme();

  const padding = sizePadding[size];

  const renderContent = (): React.ReactNode => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Spinner size="small" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="alert" size={20} color={colors.error} />
          <Text variant="bodySmall" color="error" style={styles.errorText}>
            {error.message || 'Something went wrong'}
          </Text>
        </View>
      );
    }

    return children;
  };

  return (
    <Card
      padding="none"
      elevation="sm"
      style={StyleSheet.flatten([styles.card, { borderRadius: borderRadius.xl }, style])}
    >
      {/* Header Row */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: padding,
            paddingTop: padding,
            paddingBottom: size === 'small' ? padding / 2 : spacing.xs,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <Icon
              name={icon}
              size={size === 'small' ? 16 : 18}
              color={colors.textSecondary}
              style={styles.headerIcon}
            />
          )}
          <Text
            variant={size === 'small' ? 'caption' : 'label'}
            color="secondary"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {onConfigure && (
            <Pressable
              onPress={onConfigure}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Configure ${title}`}
            >
              <Icon name="settings" size={size === 'small' ? 14 : 16} color={colors.textMuted} />
            </Pressable>
          )}
          {onExpand && (
            <Pressable
              onPress={onExpand}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Expand ${title}`}
              style={onConfigure ? styles.expandButton : undefined}
            >
              <Icon
                name="chevron-forward"
                size={size === 'small' ? 14 : 16}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content Area */}
      <ErrorBoundary>
        <View style={[styles.content, { padding }]}>{renderContent()}</View>
      </ErrorBoundary>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    marginLeft: spacing.sm,
  },
  content: {
    // Content styles are applied inline based on size
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  errorText: {
    marginLeft: spacing.xs,
    flex: 1,
  },
});

export default WidgetCard;
