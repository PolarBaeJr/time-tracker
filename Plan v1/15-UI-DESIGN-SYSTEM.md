# 15 - UI Design System (Uber-Style + Customizable Colors)

## Design Philosophy

Following Uber's design language:
- **Dark-first**: Deep dark backgrounds, clean white text
- **Minimal**: No visual clutter, generous whitespace
- **Card-based**: Content in floating cards with subtle elevation
- **Bottom-up**: Interactions via bottom sheets, not centered modals
- **Large touch targets**: Minimum 48px tap areas
- **Smooth motion**: Spring animations via react-native-reanimated

## Color System

### Base Palette (Non-customizable)
```typescript
const baseColors = {
  // Backgrounds (dark mode)
  bg: {
    primary: '#000000',       // True black (OLED friendly)
    secondary: '#141414',     // Elevated surfaces
    tertiary: '#1E1E1E',      // Cards, inputs
    overlay: 'rgba(0,0,0,0.7)', // Bottom sheet backdrop
  },
  // Backgrounds (light mode)
  bgLight: {
    primary: '#FFFFFF',
    secondary: '#F6F6F6',
    tertiary: '#EEEEEE',
    overlay: 'rgba(0,0,0,0.3)',
  },
  // Text
  text: {
    primary: '#FFFFFF',       // Dark mode
    secondary: '#8E8E93',     // Subdued text
    tertiary: '#636366',      // Hint text
    inverse: '#000000',       // On accent backgrounds
  },
  // Semantic
  success: '#34C759',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#0A84FF',
};
```

### Accent Color (User-Customizable)
```typescript
// Default accent palette
const defaultAccent = {
  primary: '#276EF1',         // Uber blue
  light: '#6BA2FF',
  dark: '#0044CC',
  subtle: 'rgba(39,110,241,0.15)', // For backgrounds
};

// User picks from presets or custom hex
const accentPresets = [
  { name: 'Blue',    primary: '#276EF1' },  // Uber default
  { name: 'Purple',  primary: '#7B61FF' },
  { name: 'Red',     primary: '#E94560' },
  { name: 'Green',   primary: '#00C853' },
  { name: 'Orange',  primary: '#FF6D00' },
  { name: 'Pink',    primary: '#FF4081' },
  { name: 'Teal',    primary: '#00BCD4' },
  { name: 'Custom',  primary: null },       // Opens color picker
];

// Light/dark variants auto-generated from primary
function generateAccentPalette(primary: string) {
  return {
    primary,
    light: lighten(primary, 0.3),
    dark: darken(primary, 0.2),
    subtle: alpha(primary, 0.15),
  };
}
```

### Color Picker in Settings
```
Appearance
──────────────────────
Theme:  [Dark ●] [Light ○] [System ○]

Accent Color:
  ● 🔵 ● 🟣 ○ 🔴 ○ 🟢 ○ 🟠 ○ 🩷 ○ Custom

Preview:
  [████████████████████]  <- Shows accent color
```

## Typography

```typescript
const typography = {
  // Uber uses a custom font (Uber Move), we'll use SF Pro / system font
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }),

  display: { fontSize: 36, fontWeight: '700', letterSpacing: -0.5 },  // Hub greeting
  h1:      { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },  // Screen titles
  h2:      { fontSize: 22, fontWeight: '600' },                        // Section headers
  h3:      { fontSize: 18, fontWeight: '600' },                        // Widget titles
  body:    { fontSize: 16, fontWeight: '400' },                        // Regular text
  caption: { fontSize: 14, fontWeight: '400', color: '#8E8E93' },     // Secondary text
  tiny:    { fontSize: 12, fontWeight: '400', color: '#636366' },     // Timestamps
};
```

## Component Patterns

### Widget Card
```
┌─────────────────────────────────┐
│  Widget Title            Action │  ← 16px padding, flex row
│─────────────────────────────────│
│                                 │
│  Content Area                   │  ← 16px horizontal, 12px vertical
│                                 │
│─────────────────────────────────│
│  Footer / Action Bar            │  ← Optional
└─────────────────────────────────┘

Styles:
- Background: bg.tertiary (#1E1E1E dark, #EEEEEE light)
- Border radius: 16px
- Shadow: 0 2px 8px rgba(0,0,0,0.3) (dark), 0 2px 8px rgba(0,0,0,0.08) (light)
- Margin between widgets: 12px
```

### Bottom Sheet (for expand/edit)
```
┌─────────────────────────────────┐
│           ═══                   │  ← Handle bar (40x4px, rounded)
│─────────────────────────────────│
│                                 │
│  Full content view              │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘

Styles:
- Background: bg.secondary
- Border radius: 24px (top only)
- Backdrop: overlay with blur
- Snap points: 50%, 90% of screen height
- Swipe down to dismiss
```

### List Item (Uber style)
```
┌─────────────────────────────────────┐
│  🔵  Title                    Meta  │
│       Subtitle / description        │
└─────────────────────────────────────┘

Styles:
- Height: 64px minimum
- Left icon: 40x40px circle with subtle accent bg
- Divider: 1px line, offset to match text start
- Press state: bg slightly lighter
```

### Button Styles
```
Primary:   [     Action     ]  ← Accent color bg, white text, 48px height, 12px radius
Secondary: [     Action     ]  ← Transparent bg, accent border, accent text
Ghost:     [     Action     ]  ← No bg, no border, accent text
Danger:    [     Delete     ]  ← Error color bg, white text
```

## Animation Guidelines

- **Page transitions**: Slide from right (push), slide from bottom (modal)
- **Widget expand**: Scale from card position to full screen (shared element)
- **Bottom sheet**: Spring animation (damping: 0.8, stiffness: 200)
- **List items**: Fade in with stagger (50ms delay per item)
- **Widget reorder**: Drag with haptic feedback, spring to position
- **Loading**: Skeleton shimmer (gradient animation)
- **Tab switch**: Cross-fade (no slide)

## Responsive Breakpoints

```typescript
const breakpoints = {
  mobile: 0,      // < 768px: single column, bottom tabs
  tablet: 768,    // 768-1024px: 2-column grid, bottom tabs
  desktop: 1024,  // > 1024px: 3-column grid, optional sidebar
};
```

## Hub Layout Grid

### Mobile (< 768px)
```
[Widget - full width]
[Widget - full width]
[Widget - full width]
```

### Tablet (768-1024px)
```
[Widget - half] [Widget - half]
[Widget - full width          ]
[Widget - half] [Widget - half]
```

### Desktop (> 1024px)
```
[Widget - 1/3] [Widget - 1/3] [Widget - 1/3]
[Widget - 2/3              ] [Widget - 1/3]
[Widget - 1/3] [Widget - 1/3] [Widget - 1/3]
```

## Accessibility

- All interactive elements: minimum 48x48px touch target
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Screen reader labels on all widgets and actions
- Keyboard navigation support on web/desktop
- Reduce motion: honor system preference, disable animations
