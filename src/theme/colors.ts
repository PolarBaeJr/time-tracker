/**
 * Color palettes for the WorkTracker app
 * Dark and light mode color definitions
 */

export const darkColors = {
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

export const lightColors = {
  // Background colors
  background: '#F8F8FA',
  surface: '#FFFFFF',
  surfaceVariant: '#F0F0F3',

  // Primary brand colors (indigo)
  primary: '#6366F1',
  primaryVariant: '#4F46E5',

  // Secondary accent color (cyan)
  secondary: '#0891B2',

  // Semantic colors
  error: '#DC2626',
  warning: '#D97706',
  success: '#059669',

  // Text colors
  text: '#18181B',
  textSecondary: '#52525B',
  textMuted: '#A1A1AA',

  // Border and divider
  border: '#E4E4E7',

  // Transparent variants for overlays
  overlay: 'rgba(0, 0, 0, 0.3)',
  overlayLight: 'rgba(0, 0, 0, 0.04)',
} as const;

// Backward compatibility: default export is the dark palette
export const colors = darkColors;

// Type for color keys
export type ColorKey = keyof typeof darkColors;

// Type for the colors object — uses string values so both palettes satisfy it
export type Colors = { readonly [K in keyof typeof darkColors]: string };
