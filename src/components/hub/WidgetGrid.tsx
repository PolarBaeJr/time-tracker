/**
 * WidgetGrid Component
 *
 * Responsive grid layout for Hub widgets.
 * Adapts column count based on screen width:
 * - 1 column (<768px)
 * - 2 columns (768-1024px)
 * - 3 columns (>1024px)
 *
 * Widget sizes affect layout:
 * - small: 1 column span
 * - medium: 1 column span (2 on desktop)
 * - large: full width
 */

import * as React from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';

import { Icon } from '@/components/ui';
import type { HubWidgetConfig } from '@/stores/hubStore';
import { useTheme } from '@/theme';

/** Breakpoints for responsive layout */
const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
} as const;

/** Gap between widgets */
const WIDGET_GAP = 12;

export interface WidgetGridProps {
  /** Array of widget configurations to render */
  widgets: HubWidgetConfig[];
  /** Render function for each widget */
  renderWidget: (widget: HubWidgetConfig) => React.ReactElement;
  /** Whether edit mode is active (shows drag handles) */
  editMode?: boolean;
  /** Style for the container */
  style?: object;
}

/**
 * Get number of columns based on screen width
 */
function getColumnCount(width: number): number {
  if (width < BREAKPOINTS.MOBILE) {
    return 1;
  } else if (width < BREAKPOINTS.TABLET) {
    return 2;
  }
  return 3;
}

/**
 * WidgetGrid Component
 *
 * Renders widgets in a responsive grid layout.
 * Supports edit mode with drag handles for reordering.
 */
export function WidgetGrid({
  widgets,
  renderWidget,
  editMode = false,
  style,
}: WidgetGridProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const columnCount = getColumnCount(width);

  // Calculate widget width based on column count and gap
  const containerPadding = 16;
  const totalGapWidth = (columnCount - 1) * WIDGET_GAP;
  const availableWidth = width - containerPadding * 2 - totalGapWidth;
  const itemWidth = availableWidth / columnCount;

  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<HubWidgetConfig>) => {
      // Determine column span based on widget size
      // large widgets take full width
      const isLargeWidget = item.size === 'large';
      const widgetWidth = isLargeWidget ? width - containerPadding * 2 : itemWidth;

      return (
        <View
          style={[
            styles.widgetContainer,
            {
              width: widgetWidth,
              marginRight: (index + 1) % columnCount === 0 || isLargeWidget ? 0 : WIDGET_GAP,
              marginBottom: WIDGET_GAP,
            },
          ]}
        >
          {editMode && (
            <View style={[styles.dragHandle, { backgroundColor: colors.surfaceVariant }]}>
              <Icon name="drag-handle" size={20} color={colors.textSecondary} />
            </View>
          )}
          {renderWidget(item)}
        </View>
      );
    },
    [columnCount, editMode, colors, itemWidth, renderWidget, width]
  );

  const keyExtractor = React.useCallback((item: HubWidgetConfig) => item.id, []);

  // For large widgets, we need to handle them specially
  // since FlatList with numColumns doesn't support variable spans
  const hasLargeWidgets = widgets.some(w => w.size === 'large');

  if (hasLargeWidgets) {
    // Fall back to ScrollView-based rendering for mixed layouts
    return (
      <View style={[styles.container, { paddingHorizontal: containerPadding }, style]}>
        <View style={styles.flexContainer}>
          {widgets.map((widget, index) => (
            <React.Fragment key={widget.id}>
              {renderItem({ item: widget, index, separators: {} as never })}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={widgets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columnCount}
      key={`grid-${columnCount}`} // Force re-render when column count changes
      contentContainerStyle={[styles.listContent, { paddingHorizontal: containerPadding }]}
      style={[styles.container, style]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false} // Parent ScrollView handles scrolling
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  flexContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
  },
  widgetContainer: {
    position: 'relative',
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
    borderRadius: 4,
  },
});

export default WidgetGrid;
