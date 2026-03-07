/**
 * Simple Icon Component
 *
 * A text-based icon fallback that uses Unicode symbols.
 * This avoids external icon package dependencies while providing
 * a consistent icon interface across the app.
 *
 * NOTE: This is a fallback solution. When @expo/vector-icons types
 * are properly available, the app can be migrated to use those icons.
 */

import * as React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Available icon names mapped to Unicode symbols
 */
export const iconMap = {
  // Navigation icons
  time: '\u23F1', // stopwatch
  'time-outline': '\u23F0', // alarm clock
  clock: '\u{1F550}', // clock face
  list: '\u2630', // hamburger menu
  'list-outline': '\u2261', // identical to
  'bar-chart': '\u2593', // dark shade
  'bar-chart-outline': '\u2591', // light shade
  folder: '\u{1F4C1}', // open folder
  'folder-outline': '\u{1F4C2}', // open file folder
  flag: '\u2691', // black flag
  'flag-outline': '\u2690', // white flag
  settings: '\u2699', // gear
  'settings-outline': '\u2638', // wheel of dharma
  filter: '\u2AF6', // triple horizontal bar filter
  search: '\u{1F50D}', // magnifying glass
  edit: '\u270E', // pencil

  // Action icons
  play: '\u25B6',
  pause: '\u23F8',
  stop: '\u23F9',
  add: '+',
  close: '\u2715',
  check: '\u2713',
  'chevron-back': '\u2039',
  'chevron-forward': '\u203A',
  'chevron-up': '\u2303',
  'chevron-down': '\u2304',
  alert: '\u26A0', // warning triangle
} as const;

export type IconName = keyof typeof iconMap;

export interface IconProps {
  /** Icon name from the iconMap */
  name: IconName;
  /** Icon size in pixels */
  size?: number;
  /** Icon color */
  color?: string;
  /** Additional text style */
  style?: TextStyle;
}

/**
 * Icon Component
 *
 * Renders a text-based icon using Unicode symbols.
 */
export function Icon({ name, size = 24, color, style }: IconProps): React.ReactElement {
  const { colors } = useTheme();
  const iconColor = color ?? colors.text;
  const symbol = iconMap[name] ?? '?';

  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: size,
          lineHeight: size * 1.2,
          color: iconColor,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={name.replace(/-/g, ' ')}
    >
      {symbol}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});

export default Icon;
