/**
 * Toast Container Component
 *
 * Positioned container that renders toasts at the top of the screen.
 * Manages toast stacking and animations.
 */

import * as React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from './Toast';
import { useToastContext } from '@/contexts/ToastContext';
import { spacing } from '@/theme';

/**
 * Position options for the toast container
 */
export type ToastPosition = 'top' | 'bottom';

/**
 * Props for the ToastContainer component
 */
export interface ToastContainerProps {
  /** Position of the toast container (default: 'top') */
  position?: ToastPosition;
}

/**
 * Toast Container Component
 *
 * Renders all active toasts in a positioned container.
 * Place this component at the root of your app, after the ToastProvider.
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 *   <ToastContainer position="top" />
 * </ToastProvider>
 * ```
 */
export function ToastContainer({
  position = 'top',
}: ToastContainerProps): React.ReactElement | null {
  const { toasts, removeToast } = useToastContext();
  const insets = useSafeAreaInsets();

  // Don't render anything if no toasts
  if (toasts.length === 0) {
    return null;
  }

  // Calculate safe area padding
  const topPadding =
    position === 'top' ? Math.max(insets.top, spacing.md) + spacing.sm : spacing.md;
  const bottomPadding =
    position === 'bottom' ? Math.max(insets.bottom, spacing.md) + spacing.sm : spacing.md;

  const containerStyle = [
    styles.container,
    position === 'top' ? styles.positionTop : styles.positionBottom,
    {
      paddingTop: position === 'top' ? topPadding : spacing.md,
      paddingBottom: position === 'bottom' ? bottomPadding : spacing.md,
    },
  ];

  // Render toasts in reverse order for bottom position (newest on top)
  const orderedToasts = position === 'bottom' ? [...toasts].reverse() : toasts;

  return (
    <View
      style={containerStyle}
      pointerEvents="box-none"
      accessibilityLabel="Notifications"
      accessible={true}
    >
      {orderedToasts.map((toast, index) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onDismiss={removeToast}
          index={index}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 9999,
    // Allow touches to pass through to content below
    ...(Platform.OS === 'web' ? { pointerEvents: 'box-none' as const } : {}),
  },
  positionTop: {
    top: 0,
  },
  positionBottom: {
    bottom: 0,
  },
});

export default ToastContainer;
