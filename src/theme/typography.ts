/**
 * Typography scale for consistent text sizing across the app
 * Font sizes follow a harmonious scale for visual hierarchy
 */

export const fontSizes = {
  xs: 12, // Extra small: captions, labels
  sm: 14, // Small: secondary text, metadata
  md: 16, // Medium: body text (default)
  lg: 20, // Large: subtitles, emphasized text
  xl: 24, // Extra large: section headers
  xxl: 32, // Extra extra large: screen titles
  display: 48, // Display: hero text, timer display
} as const;

export const fontWeights = {
  normal: '400' as const, // Regular text
  medium: '500' as const, // Slightly emphasized
  semibold: '600' as const, // Headers, important text
  bold: '700' as const, // Strong emphasis, titles
};

/**
 * Line heights for better readability
 * Based on 1.5x multiplier for body text
 */
export const lineHeights = {
  tight: 1.2, // Compact text, headers
  normal: 1.5, // Body text
  relaxed: 1.75, // Long-form content
} as const;

// Type exports
export type FontSizeKey = keyof typeof fontSizes;
export type FontWeightKey = keyof typeof fontWeights;
export type LineHeightKey = keyof typeof lineHeights;

export type FontSizes = typeof fontSizes;
export type FontWeights = typeof fontWeights;
export type LineHeights = typeof lineHeights;
