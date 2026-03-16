/**
 * Clipboard Utilities
 *
 * Cross-platform clipboard functionality that works in both web and native environments.
 */

import { Platform } from 'react-native';

/**
 * Copy text to the system clipboard
 *
 * Uses the web Clipboard API on web platforms and falls back to
 * a simple approach that works across platforms.
 *
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - true if copy was successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      // Use web Clipboard API
      await navigator.clipboard.writeText(text);
      return true;
    }

    // For native platforms, we use the Clipboard API available via React Native
    // This is a simplified fallback - in production you might want expo-clipboard
    if (Platform.OS !== 'web') {
      // On native, we need to use the Clipboard from react-native
      // Dynamically import to avoid bundling issues
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Clipboard } = require('react-native');
        Clipboard.setString(text);
        return true;
      } catch {
        // If Clipboard is not available (deprecated), try expo-clipboard
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ExpoClipboard = require('expo-clipboard');
          await ExpoClipboard.setStringAsync(text);
          return true;
        } catch {
          console.warn('[clipboard] No clipboard API available');
          return false;
        }
      }
    }

    return false;
  } catch (error) {
    console.warn('[clipboard] Failed to copy to clipboard:', error);
    return false;
  }
}
