/**
 * Toast Context for managing toast notifications
 *
 * Provides state management for toast notifications with add/remove/clear operations.
 * Used by the useToast hook to show toast messages throughout the app.
 */

import * as React from 'react';
import { createContext, useContext, useCallback, useMemo, useReducer } from 'react';

/**
 * Toast variant types
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast data structure
 */
export interface Toast {
  /** Unique identifier for the toast */
  id: string;
  /** Message to display */
  message: string;
  /** Toast variant (determines color/icon) */
  variant: ToastVariant;
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration: number;
  /** Timestamp when toast was created */
  createdAt: number;
}

/**
 * Options for creating a toast
 */
export interface ToastOptions {
  /** Toast variant (default: 'info') */
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss (default: 4000, 0 = no auto-dismiss) */
  duration?: number;
}

/**
 * Toast context value
 */
export interface ToastContextValue {
  /** Current toasts (max 3) */
  toasts: Toast[];
  /** Add a new toast */
  addToast: (message: string, options?: ToastOptions) => string;
  /** Remove a toast by id */
  removeToast: (id: string) => void;
  /** Clear all toasts */
  clearToasts: () => void;
}

/**
 * Toast state
 */
interface ToastState {
  toasts: Toast[];
}

/**
 * Toast action types
 */
type ToastAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'CLEAR_TOASTS' };

/**
 * Maximum number of toasts to display at once
 */
const MAX_TOASTS = 3;

/**
 * Default duration for auto-dismiss in milliseconds
 */
export const DEFAULT_TOAST_DURATION = 4000;

/**
 * Toast reducer
 */
function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST': {
      // Add new toast and limit to MAX_TOASTS (remove oldest if necessary)
      const newToasts = [...state.toasts, action.payload];
      if (newToasts.length > MAX_TOASTS) {
        // Remove the oldest toast(s) to stay within limit
        return { toasts: newToasts.slice(-MAX_TOASTS) };
      }
      return { toasts: newToasts };
    }
    case 'REMOVE_TOAST':
      return {
        toasts: state.toasts.filter(toast => toast.id !== action.payload),
      };
    case 'CLEAR_TOASTS':
      return { toasts: [] };
    default:
      return state;
  }
}

/**
 * Generate unique ID for toasts
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Toast Context
 */
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Toast Provider Props
 */
interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * Toast Provider Component
 *
 * Wrap your app with this provider to enable toast notifications.
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 *   <ToastContainer />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: ToastProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const addToast = useCallback((message: string, options?: ToastOptions): string => {
    const id = generateToastId();
    const toast: Toast = {
      id,
      message,
      variant: options?.variant ?? 'info',
      duration: options?.duration ?? DEFAULT_TOAST_DURATION,
      createdAt: Date.now(),
    };

    dispatch({ type: 'ADD_TOAST', payload: toast });
    return id;
  }, []);

  const removeToast = useCallback((id: string): void => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const clearToasts = useCallback((): void => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts: state.toasts,
      addToast,
      removeToast,
      clearToasts,
    }),
    [state.toasts, addToast, removeToast, clearToasts]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * Hook to access the toast context
 *
 * @throws Error if used outside of ToastProvider
 */
export function useToastContext(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}

export { ToastContext };
export default ToastProvider;
