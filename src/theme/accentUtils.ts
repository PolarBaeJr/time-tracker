function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0').toUpperCase() +
    clamp(g).toString(16).padStart(2, '0').toUpperCase() +
    clamp(b).toString(16).padStart(2, '0').toUpperCase()
  );
}

function adjustBrightness(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function withOpacity(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Hard-coded mapping for the default indigo accent so the output exactly
// matches the original darkColors/lightColors values.
const DEFAULT_PRIMARY = '#6366F1';
const DEFAULT_VARIANT = '#4F46E5';

export function generateAccentPalette(primary: string): {
  primary: string;
  primaryVariant: string;
  secondary: string;
  subtle: string;
} {
  const isDefault = primary.toUpperCase() === DEFAULT_PRIMARY.toUpperCase();
  return {
    primary,
    primaryVariant: isDefault ? DEFAULT_VARIANT : adjustBrightness(primary, 0.8),
    secondary: adjustBrightness(primary, 1.3),
    subtle: withOpacity(primary, 0.15),
  };
}
