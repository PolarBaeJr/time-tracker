/**
 * Dark mode color palette for the WorkTracker app
 * All colors are designed for optimal contrast and accessibility in dark mode
 */

export const colors = {
  // Background colors
  background: '#0F0F0F', // Main app background
  surface: '#1A1A1A', // Card/surface backgrounds
  surfaceVariant: '#252525', // Elevated surfaces, inputs

  // Primary brand colors (indigo)
  primary: '#6366F1', // Primary actions, active elements
  primaryVariant: '#4F46E5', // Darker primary for pressed states

  // Secondary accent color (cyan)
  secondary: '#22D3EE', // Secondary actions, accents

  // Semantic colors
  error: '#EF4444', // Error states, destructive actions
  warning: '#F59E0B', // Warning states, caution
  success: '#10B981', // Success states, positive feedback

  // Text colors
  text: '#FFFFFF', // Primary text
  textSecondary: '#A1A1AA', // Secondary/muted text
  textMuted: '#71717A', // Disabled/hint text

  // Border and divider
  border: '#27272A', // Borders, dividers, separators

  // Transparent variants for overlays
  overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlays
  overlayLight: 'rgba(255, 255, 255, 0.05)', // Subtle highlights
} as const;

// Type for color keys
export type ColorKey = keyof typeof colors;

// Type for the colors object
export type Colors = typeof colors;
