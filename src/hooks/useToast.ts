/**
 * useToast Hook
 *
 * Provides convenient methods for showing toast notifications.
 * Returns typed methods for success, error, warning, and info toasts.
 */

import { useCallback, useMemo } from 'react';

import {
  useToastContext,
  type ToastOptions,
  type ToastVariant,
  DEFAULT_TOAST_DURATION,
} from '@/contexts/ToastContext';

/**
 * Options for individual toast methods (without variant)
 */
export interface ShowToastOptions {
  /** Duration in ms before auto-dismiss (default: 4000, 0 = no auto-dismiss) */
  duration?: number;
}

/**
 * Return type for useToast hook
 */
export interface UseToastResult {
  /**
   * Show a toast with custom variant
   * @param message - Message to display
   * @param options - Toast options including variant
   * @returns Toast ID
   */
  toast: (message: string, options?: ToastOptions) => string;

  /**
   * Show a success toast (green)
   * @param message - Message to display
   * @param options - Toast options
   * @returns Toast ID
   */
  success: (message: string, options?: ShowToastOptions) => string;

  /**
   * Show an error toast (red)
   * @param message - Message to display
   * @param options - Toast options
   * @returns Toast ID
   */
  error: (message: string, options?: ShowToastOptions) => string;

  /**
   * Show a warning toast (yellow)
   * @param message - Message to display
   * @param options - Toast options
   * @returns Toast ID
   */
  warning: (message: string, options?: ShowToastOptions) => string;

  /**
   * Show an info toast (blue)
   * @param message - Message to display
   * @param options - Toast options
   * @returns Toast ID
   */
  info: (message: string, options?: ShowToastOptions) => string;

  /**
   * Dismiss a specific toast by ID
   * @param id - Toast ID to dismiss
   */
  dismiss: (id: string) => void;

  /**
   * Dismiss all toasts
   */
  dismissAll: () => void;
}

/**
 * useToast Hook
 *
 * Provides convenient methods for showing toast notifications.
 *
 * @returns Object with toast methods: toast, success, error, warning, info, dismiss, dismissAll
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { success, error, warning, info } = useToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       success('Data saved successfully!');
 *     } catch (err) {
 *       error('Failed to save data');
 *     }
 *   };
 *
 *   return <Button onPress={handleSave}>Save</Button>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom duration
 * const { info } = useToast();
 * info('Processing...', { duration: 0 }); // Won't auto-dismiss
 *
 * // Dismiss a specific toast
 * const { success, dismiss } = useToast();
 * const toastId = success('Done!');
 * dismiss(toastId); // Manually dismiss
 *
 * // Dismiss all toasts
 * const { dismissAll } = useToast();
 * dismissAll();
 * ```
 */
export function useToast(): UseToastResult {
  const { addToast, removeToast, clearToasts } = useToastContext();

  const toast = useCallback(
    (message: string, options?: ToastOptions): string => {
      return addToast(message, options);
    },
    [addToast]
  );

  const success = useCallback(
    (message: string, options?: ShowToastOptions): string => {
      return addToast(message, { ...options, variant: 'success' });
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: ShowToastOptions): string => {
      return addToast(message, { ...options, variant: 'error' });
    },
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: ShowToastOptions): string => {
      return addToast(message, { ...options, variant: 'warning' });
    },
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: ShowToastOptions): string => {
      return addToast(message, { ...options, variant: 'info' });
    },
    [addToast]
  );

  const dismiss = useCallback(
    (id: string): void => {
      removeToast(id);
    },
    [removeToast]
  );

  const dismissAll = useCallback((): void => {
    clearToasts();
  }, [clearToasts]);

  return useMemo(
    () => ({
      toast,
      success,
      error,
      warning,
      info,
      dismiss,
      dismissAll,
    }),
    [toast, success, error, warning, info, dismiss, dismissAll]
  );
}

export { DEFAULT_TOAST_DURATION };
export type { ToastVariant, ToastOptions };
