/**
 * Network Status Hook
 *
 * Provides network connectivity status for offline-first functionality.
 * Uses navigator.onLine on web and falls back to connectivity checks
 * for native platforms when @react-native-community/netinfo is not available.
 *
 * USAGE:
 * ```typescript
 * import { useNetworkStatus } from '@/hooks/useNetworkStatus';
 *
 * function MyComponent() {
 *   const { isOnline, isConnected } = useNetworkStatus();
 *
 *   if (!isOnline) {
 *     return <OfflineBanner />;
 *   }
 *
 *   return <OnlineContent />;
 * }
 * ```
 *
 * NOTE: This implementation uses navigator.onLine which works on web.
 * For native platforms, it provides a basic implementation that can be
 * enhanced when @react-native-community/netinfo is installed.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Network status information
 */
export interface NetworkStatus {
  /** Whether the device appears to have network connectivity */
  isOnline: boolean;
  /** Whether the device is connected (same as isOnline for this implementation) */
  isConnected: boolean;
  /** Connection type if available */
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';
  /** Last time the status was checked */
  lastChecked: Date;
}

/**
 * Options for useNetworkStatus hook
 */
export interface UseNetworkStatusOptions {
  /**
   * How often to poll for connectivity in milliseconds (default: 30000)
   * Only used when event-based detection is not available
   */
  pollingInterval?: number;

  /**
   * URL to ping for connectivity check (optional)
   * If provided, will make a lightweight request to verify actual connectivity
   */
  pingUrl?: string;

  /**
   * Whether to enable polling (default: false on web where events are available)
   */
  enablePolling?: boolean;
}

/**
 * Result of the useNetworkStatus hook
 */
export interface UseNetworkStatusResult extends NetworkStatus {
  /** Manually trigger a connectivity check */
  checkConnectivity: () => Promise<boolean>;
  /** Whether a connectivity check is in progress */
  isChecking: boolean;
}

/**
 * Check if we're running in a browser environment with navigator.onLine support
 */
function hasNavigatorOnLine(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.onLine === 'boolean'
  );
}

/**
 * Get the current online status from navigator
 */
function getNavigatorOnlineStatus(): boolean {
  if (hasNavigatorOnLine()) {
    return navigator.onLine;
  }
  // Default to true if we can't determine (optimistic)
  return true;
}

/**
 * Perform a lightweight connectivity check
 *
 * @param url - URL to check (optional)
 * @returns Promise resolving to true if connected
 */
async function checkConnectivity(url?: string): Promise<boolean> {
  // If no URL provided, just use navigator.onLine
  if (!url) {
    return getNavigatorOnlineStatus();
  }

  try {
    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Any response (even opaque) means we're online
    return response.ok || response.type === 'opaque';
  } catch {
    return false;
  }
}

/**
 * Hook to monitor network connectivity status
 *
 * @param options - Configuration options
 * @returns Network status information and utilities
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { isOnline } = useNetworkStatus();
 *
 * // With polling for native platforms
 * const { isOnline, checkConnectivity } = useNetworkStatus({
 *   enablePolling: Platform.OS !== 'web',
 *   pollingInterval: 15000,
 * });
 *
 * // With connectivity ping
 * const { isOnline } = useNetworkStatus({
 *   pingUrl: 'https://example.com/health',
 * });
 * ```
 */
export function useNetworkStatus(options?: UseNetworkStatusOptions): UseNetworkStatusResult {
  const {
    pollingInterval = 30000,
    pingUrl,
    enablePolling = Platform.OS !== 'web',
  } = options ?? {};

  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: getNavigatorOnlineStatus(),
    isConnected: getNavigatorOnlineStatus(),
    connectionType: 'unknown',
    lastChecked: new Date(),
  }));

  const [isChecking, setIsChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  /**
   * Update the network status
   */
  const updateStatus = useCallback((isOnline: boolean) => {
    if (!mountedRef.current) return;

    setStatus((prev) => {
      // Only update if status changed
      if (prev.isOnline === isOnline) {
        return { ...prev, lastChecked: new Date() };
      }

      return {
        isOnline,
        isConnected: isOnline,
        connectionType: isOnline ? 'unknown' : 'none',
        lastChecked: new Date(),
      };
    });
  }, []);

  /**
   * Manual connectivity check
   */
  const performCheck = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current) return false;

    setIsChecking(true);
    try {
      const online = await checkConnectivity(pingUrl);
      updateStatus(online);
      return online;
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [pingUrl, updateStatus]);

  // Set up event listeners for web
  useEffect(() => {
    mountedRef.current = true;

    // Web event listeners
    if (Platform.OS === 'web' && hasNavigatorOnLine()) {
      const handleOnline = () => updateStatus(true);
      const handleOffline = () => updateStatus(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        mountedRef.current = false;
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [updateStatus]);

  // Set up polling if enabled
  useEffect(() => {
    if (!enablePolling || pollingInterval <= 0) {
      return;
    }

    // Initial check
    performCheck();

    // Set up polling interval
    pollingRef.current = setInterval(() => {
      performCheck();
    }, pollingInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enablePolling, pollingInterval, performCheck]);

  return {
    ...status,
    checkConnectivity: performCheck,
    isChecking,
  };
}

/**
 * Get current network status (non-hook version for use in services)
 *
 * @returns Current network status
 */
export function getNetworkStatus(): NetworkStatus {
  const isOnline = getNavigatorOnlineStatus();
  return {
    isOnline,
    isConnected: isOnline,
    connectionType: isOnline ? 'unknown' : 'none',
    lastChecked: new Date(),
  };
}

/**
 * Check if device is currently online (non-hook version)
 *
 * @returns true if device appears to be online
 */
export function isDeviceOnline(): boolean {
  return getNavigatorOnlineStatus();
}

export type { NetworkStatus as NetworkStatusType };
