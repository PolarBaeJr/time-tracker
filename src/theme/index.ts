/**
 * Theme configuration and design tokens
 * Consolidates colors, spacing, and typography into a single theme object
 */

import * as React from 'react';
import { createContext, useContext } from 'react';

// Re-export all theme modules
export * from './colors';
export * from './spacing';
export * from './typography';

// Import for theme object composition
import { darkColors, lightColors, type Colors } from './colors';
import { spacing, type Spacing } from './spacing';
import {
  fontSizes,
  fontWeights,
  lineHeights,
  type FontSizes,
  type FontWeights,
  type LineHeights,
} from './typography';
import { useThemePreference } from '@/stores/themeStore';

/**
 * Border radius scale for consistent rounded corners
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999, // Circular/pill shapes
} as const;

export type BorderRadiusKey = keyof typeof borderRadius;
export type BorderRadius = typeof borderRadius;

/**
 * Shadow definitions for elevation
 * Note: React Native shadows work differently on iOS vs Android
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

export type ShadowKey = keyof typeof shadows;
export type Shadows = typeof shadows;

/**
 * Complete theme object containing all design tokens
 */
export const theme = {
  colors: darkColors,
  spacing,
  fontSizes,
  fontWeights,
  lineHeights,
  borderRadius,
  shadows,
} as const;

/**
 * Theme type definition
 */
export interface Theme {
  colors: Colors;
  spacing: Spacing;
  fontSizes: FontSizes;
  fontWeights: FontWeights;
  lineHeights: LineHeights;
  borderRadius: BorderRadius;
  shadows: Shadows;
  isDark: boolean;
}

/**
 * ThemeContext for theming support (light mode, dark mode, system)
 */
export const ThemeContext = createContext<Theme>({
  ...theme,
  isDark: true,
});

/**
 * Hook to access the current theme
 * @returns The current theme object with colors, spacing, and isDark flag
 */
export function useTheme(): Theme {
  const currentTheme = useContext(ThemeContext);
  if (!currentTheme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return currentTheme;
}

/**
 * ThemeProvider component props
 */
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * ThemeProvider component
 * Wraps the app to provide theme context to all components
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const resolved = useThemePreference(s => s.resolved);
  const isDark = resolved === 'dark';
  const currentColors = isDark ? darkColors : lightColors;

  const value = React.useMemo<Theme>(
    () => ({
      colors: currentColors,
      spacing,
      fontSizes,
      fontWeights,
      lineHeights,
      borderRadius,
      shadows,
      isDark,
    }),
    [isDark, currentColors]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

// Default export for convenient imports
export default theme;
