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
  home: '\u{1F3E0}', // house
  'home-outline': '\u2302', // house outline
  time: '\u23F1', // stopwatch
  'time-outline': '\u23F0', // alarm clock
  clock: '\u{1F550}', // clock face
  list: '\u2630', // hamburger menu
  'list-outline': '\u2261', // identical to
  'bar-chart': '\u2593', // dark shade
  'bar-chart-outline': '\u2591', // light shade
  folder: '\u25A6', // category squares filled
  'folder-outline': '\u25A1', // category square outline
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
  trash: '\u{1F5D1}', // wastebasket
  scissors: '\u2702', // scissors
  merge: '\u2A2F', // vector cross product (merge icon)
  'checkbox-blank': '\u2610', // ballot box
  'checkbox-checked': '\u2611', // ballot box with check
  select: '\u2610', // ballot box (select mode)
  copy: '\u2398', // next page (copy/duplicate)
  dollar: '$', // dollar sign
  plus: '+', // plus sign
  save: '\u{1F4BE}', // floppy disk
  comment: '\u{1F4AC}', // speech bubble
  tag: '\u{1F3F7}', // label/tag
  attach: '\u{1F4CE}', // paperclip
  file: '\u{1F4C4}', // page facing up
  'drag-handle': '\u2630', // hamburger
  eye: '\u{1F441}', // eye
  'eye-off': '\u25CB', // circle
  pin: '\u{1F4CC}', // pushpin
  'pin-off': '\u{1F4CC}', // pushpin (same symbol, different state handled by context)
  'file-text': '\u{1F4C4}', // page facing up (same as file)
  'file-text-outline': '\u{1F4C3}', // page with curl (document outline)
  'check-square': '\u2611', // ballot box with check (todo icon)

  // Email and communication icons
  mail: '\u2709', // envelope
  'mail-outline': '\u2709', // envelope
  'mail-open-outline': '\u2709', // envelope (open)
  'checkmark-circle': '\u2714', // heavy check mark
  sparkles: '\u2728', // sparkles emoji
  refresh: '\u21BB', // clockwise open circle arrow
  'refresh-cw': '\u21BB', // refresh clockwise

  // Calendar icons
  calendar: '\u{1F4C5}', // calendar emoji
  'calendar-outline': '\u{1F4C5}', // calendar
  sunny: '\u2600', // sun
  location: '\u{1F4CD}', // round pushpin
  x: '\u2715', // multiplication x (same as close)
  server: '\u{1F5A5}', // desktop computer (used for server)

  // Chat icons
  'chat-bubble': '\u{1F4AC}', // speech bubble
  send: '\u27A4', // right arrow (send)
  'arrow-back': '\u2190', // left arrow
  warning: '\u26A0', // warning sign (same as alert)
  'alert-circle': '\u26A0', // alert with circle (using warning)
  'more-vertical': '\u22EE', // vertical ellipsis (options menu)

  // Onboarding icons
  rocket: '\u{1F680}', // rocket emoji
  celebration: '\u{1F389}', // party popper
  'waving-hand': '\u{1F44B}', // waving hand
  star: '\u2B50', // star
  sparkle: '\u2728', // sparkles

  // Collaboration icons
  briefcase: '\u{1F4BC}', // briefcase emoji
  'briefcase-outline': '\u{1F4BC}', // briefcase (outline same)
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
  // Ensure fontSize is never 0 (crashes Android Fabric: TextAttributeProps.getLetterSpacing)
  const safeSize = Math.max(size, 1);

  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: safeSize,
          lineHeight: safeSize * 1.2,
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
