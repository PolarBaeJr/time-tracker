/**
 * Spacing scale for consistent margins, paddings, and gaps
 * Based on a 4px base unit for pixel-perfect alignment
 */

export const spacing = {
  xs: 4, // Extra small: tight spacing, compact elements
  sm: 8, // Small: inline elements, icon padding
  md: 16, // Medium: default padding, card content
  lg: 24, // Large: section spacing, larger gaps
  xl: 32, // Extra large: major section breaks
  xxl: 48, // Extra extra large: page margins, hero spacing
} as const;

// Type for spacing keys
export type SpacingKey = keyof typeof spacing;

// Type for the spacing object
export type Spacing = typeof spacing;

/**
 * Helper function to get spacing value
 * @param key - The spacing key
 * @returns The spacing value in pixels
 */
export function getSpacing(key: SpacingKey): number {
  return spacing[key];
}
