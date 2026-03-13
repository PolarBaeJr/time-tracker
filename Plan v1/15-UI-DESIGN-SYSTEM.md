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

### Button Interactive States (CRITICAL)

**Every button and pressable element MUST feel alive.** No static color swaps.

```typescript
// Use react-native-reanimated for all button interactions
// Animated values drive scale, opacity, and background color

// Press animation (mobile + web click):
//   - Scale down to 0.97 on press, spring back to 1.0 on release
//   - Background darkens 10% on press
//   - Spring config: { damping: 15, stiffness: 400 }
//   - Duration: never use timing(), always useSpring()

// Hover animation (web + desktop ONLY):
//   - Background lightens 8% on hover (subtle glow effect)
//   - Cursor: pointer
//   - Scale up to 1.02 on hover
//   - Transition: 150ms ease-out (CSS transition for web perf)
//   - Shadow increases on hover (elevation bump)

// Focus animation (keyboard navigation):
//   - 2px accent-colored ring, 2px offset
//   - Visible only on keyboard focus (not click)

// Disabled state:
//   - Opacity: 0.4
//   - No hover/press effects
//   - Cursor: not-allowed (web)

// Loading state:
//   - Spinner replaces text (existing)
//   - Button stays same size (no layout shift)
//   - Subtle pulse animation on the spinner
```

**Implementation approach:**
```typescript
// Wrap Pressable with Animated.View from reanimated
// Use useAnimatedStyle + useSharedValue for scale/bg
// Use onHoverIn/onHoverOut for web hover states
// Platform.OS === 'web' ? add CSS transition : use reanimated springs
// Apply to: Button, Card (pressable), ListItem, TabBarButton, IconButton
```

### Card Interactive States

Cards that are pressable should also respond:
```
Hover:  Slight upward translate (translateY: -2px), shadow increase
Press:  Scale 0.98, shadow decrease
Active: Accent-colored left border (3px)
```

### Settings Screen Layout

**Current problem:** Flat scroll of cards with no visual hierarchy. Looks like a debug menu.

**Desktop/Web layout (>1024px):**
```
+--------------------------------------------------+
|  Settings                                         |
+--------------------------------------------------+
|                    |                               |
|  [Sidebar Nav]     |  [Content Area]               |
|                    |                               |
|  ● General         |  General                      |
|    Timezone         |  ┌─────────────────────────┐  |
|    Week Start       |  │ Timezone                │  |
|    Date Format      |  │ [America/Los_Angeles ▼] │  |
|                    |  ├─────────────────────────┤  |
|  ● Appearance       |  │ Week Starts On          │  |
|    Theme            |  │ [Monday ▼]              │  |
|    Accent Color     |  └─────────────────────────┘  |
|                    |                               |
|  ● Timer            |  ┌─────────────────────────┐  |
|    Pomodoro         |  │ Date Format             │  |
|    Sounds           |  │ ○ MM/DD ● DD/MM ○ ISO   │  |
|    Idle Detection   |  └─────────────────────────┘  |
|                    |                               |
|  ● Integrations     |                               |
|    Spotify          |                               |
|    Email            |                               |
|    Calendar         |                               |
|    AI Provider      |                               |
|                    |                               |
|  ● Account          |                               |
|    Profile          |                               |
|    Sign Out         |                               |
|                    |                               |
+--------------------------------------------------+
```

**Mobile layout (<768px):**
```
+---------------------------+
|  Settings                 |
+---------------------------+
|                           |
|  GENERAL                  |  ← Section header: uppercase, caption size,
|  ┌───────────────────┐    |     accent color, 32px top margin
|  │ Timezone       ▸  │    |
|  ├───────────────────┤    |  ← Grouped in a single card with dividers
|  │ Week Start     ▸  │    |     (like iOS Settings)
|  ├───────────────────┤    |
|  │ Date Format    ▸  │    |
|  └───────────────────┘    |
|                           |
|  APPEARANCE               |
|  ┌───────────────────┐    |
|  │ Theme          ▸  │    |
|  ├───────────────────┤    |
|  │ Accent Color   ▸  │    |
|  └───────────────────┘    |
|                           |
|  TIMER                    |
|  ┌───────────────────┐    |
|  │ Pomodoro       ▸  │    |
|  ├───────────────────┤    |
|  │ Sounds         ▸  │    |
|  ├───────────────────┤    |
|  │ Idle Detection ▸  │    |
|  └───────────────────┘    |
|                           |
|  INTEGRATIONS             |
|  ┌───────────────────┐    |
|  │ 🟢 Spotify     ▸  │    |  ← Green dot = connected
|  ├───────────────────┤    |
|  │ ○  Email        ▸  │    |  ← Empty dot = not connected
|  ├───────────────────┤    |
|  │ ○  Calendar     ▸  │    |
|  ├───────────────────┤    |
|  │ 🟢 AI Provider  ▸  │    |
|  └───────────────────┘    |
|                           |
|  ACCOUNT                  |
|  ┌───────────────────┐    |
|  │ matt@email.com     │    |
|  ├───────────────────┤    |
|  │ Sign Out       ▸  │    |  ← Danger/red text
|  └───────────────────┘    |
|                           |
|  v1.2.0                   |  ← Version at bottom, muted
+---------------------------+
```

**Key settings design rules:**
- Group related settings in single cards with internal dividers (iOS pattern)
- Section headers: uppercase, small, accent colored, generous top margin
- Each row: 56px height, icon left, label center, value/chevron right
- Expandable sections (tap row → slide-down content) instead of navigation push for simple toggles
- Sub-screens for complex settings (Pomodoro presets, AI provider setup)
- Connected integrations show green status dot, disconnected show empty circle

### Toggle / Switch Style
```
Off:  [○─────────]  Gray track, white thumb
On:   [─────────●]  Accent track, white thumb
      Thumb slides with spring animation (not linear)
      Track color transitions with 200ms ease
```

### Input Fields
```
Default:  ┌─────────────────────┐
          │ Label               │  ← Floats above on focus
          │ Placeholder text    │
          └─────────────────────┘

Focused:  ┌─────────────────────┐  ← 2px accent border
          │ Label (accent color)│
          │ User input text     │
          └─────────────────────┘

Error:    ┌─────────────────────┐  ← 2px error border
          │ Label (error color) │
          │ User input text     │
          └─────────────────────┘
          ⚠ Error message here

Styles:
- Height: 56px
- Background: bg.tertiary
- Border radius: 12px
- Border: 1px border color (default), 2px accent (focus), 2px error
- Floating label animation: translateY + fontSize change
```

## Animation Guidelines

**Core principle: everything that can move, should move — but subtly.**

- **Page transitions**: Slide from right (push), slide from bottom (modal)
- **Widget expand**: Scale from card position to full screen (shared element)
- **Bottom sheet**: Spring animation (damping: 0.8, stiffness: 200)
- **List items**: Fade in with stagger (50ms delay per item)
- **Widget reorder**: Drag with haptic feedback, spring to position
- **Loading**: Skeleton shimmer (gradient animation)
- **Tab switch**: Cross-fade (no slide)
- **Button press**: Scale 0.97 + darken, spring back
- **Button hover (web)**: Scale 1.02 + lighten + shadow lift, 150ms ease
- **Card hover (web)**: translateY -2px + shadow increase, 150ms ease
- **Toggle switch**: Spring thumb slide + track color transition
- **Input focus**: Border color transition 200ms + floating label spring
- **Screen mount**: Content fades in 300ms with slight translateY (8px → 0px)
- **Pull to refresh**: Custom spinner with accent color
- **Haptic feedback**: On button press, toggle switch, drag start/end (native only)

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

## Hub Empty/Disconnected State Rules

**The Hub must NEVER look empty.** All widgets render regardless of connection status.

### Disconnected Widget States
When a service is not connected, the widget still shows — but with a connect prompt:

```
┌─────────────────────────────────┐
│  📧 Email                       │
│─────────────────────────────────│
│                                 │
│      Connect your email         │
│      to see messages here       │
│                                 │
│      [Connect Gmail]            │
│      [Connect Outlook]          │
│                                 │
└─────────────────────────────────┘
```

### Rules:
- **All default widgets render on first load** — timer summary, email, calendar, tasks, weather, quick links
- Disconnected widgets show: icon + service name + "Connect X to see Y here" + connect button(s)
- Connect buttons go directly to the relevant Settings section
- Connected widgets show real data with skeleton loading states
- **No "Add Widget" empty state** — the grid is pre-populated with sensible defaults
- Users can hide widgets they don't want (edit mode), but they can't end up with an empty hub
- Minimum 4 widgets always visible (timer, tasks, calendar, email or weather as fallback)

### Widget Loading States
```
┌─────────────────────────────────┐
│  📅 Calendar                    │
│─────────────────────────────────│
│  ░░░░░░░░░░░░░░░░  ░░░░        │  ← Skeleton shimmer
│  ░░░░░░░░░░░░  ░░░░░░░░        │
│  ░░░░░░░░░░░░░░░░░░  ░░        │
└─────────────────────────────────┘
```

### Widget Error States
```
┌─────────────────────────────────┐
│  📧 Email               ⟳      │  ← Retry button in header
│─────────────────────────────────│
│                                 │
│      Couldn't load emails       │
│      [Retry]  [Reconnect]       │
│                                 │
└─────────────────────────────────┘
```

## Screen-by-Screen Redesign Scope

Every screen must be updated to match the design system. Here's the full list:

| Screen | Key Changes |
|--------|-------------|
| **HubScreen** | Pre-populated widget grid, never empty, skeleton loading, greeting animation |
| **TimerScreen** | Larger display font, accent-colored progress ring, animated start/stop, focus mode redesign |
| **HistoryScreen** | Grouped by date with sticky headers, swipe-to-delete, filter chips with accent highlight |
| **AnalyticsScreen** | Chart colors use accent palette, card hover effects, animated number counters |
| **CategoriesScreen** | Color picker redesign, drag-to-reorder with haptics, category icons |
| **GoalsScreen** | Progress bars with accent color, animated fill on mount, milestone indicators |
| **SettingsScreen** | iOS-style grouped sections (see layout above), sidebar on desktop, status dots for integrations |
| **LoginScreen** | Centered card, accent gradient behind logo, smooth field focus animations |
| **SetupScreen** | Step indicator with accent color, animated transitions between steps |
| **FocusModeScreen** | Minimal dark UI, breathing animation, large timer, accent pulse on tick |

## Navigation Redesign

**Current problem:** 7 bottom tabs is too many. Cramped on mobile, wastes space on desktop.

### Mobile Navigation (<768px)
```
Bottom Tab Bar (5 tabs max):
┌─────────────────────────────────────┐
│  Hub    Timer   History   Analytics  │
│  🏠      ⏱       📋        📊      │
│                                ···   │  ← "More" overflow menu
└─────────────────────────────────────┘

"More" menu (bottom sheet):
┌─────────────────────────────────┐
│           ═══                   │
│  Categories                     │
│  Goals                          │
│  Settings                       │
└─────────────────────────────────┘
```

### Desktop Navigation (>1024px)
```
┌──────────┬──────────────────────────────┐
│          │                              │
│  🏠 Hub  │  [Screen Content]            │
│  ⏱ Timer │                              │
│  📋 Hist │                              │
│  📊 Stats│                              │
│  📂 Cats │                              │
│  🎯 Goals│                              │
│          │                              │
│  ─────── │                              │
│  ⚙ Set.  │                              │
│          │                              │
└──────────┴──────────────────────────────┘

Sidebar:
- Width: 72px collapsed (icons only), 240px expanded
- Toggle with hamburger or hover-to-expand
- Active tab: accent bg highlight + bold label
- Hover: subtle bg highlight
- Settings pinned to bottom
- Collapse/expand animates with spring
```

### Tab Bar Styling
```
- Background: bg.secondary with top border (1px, border color)
- Active icon: accent color, label bold
- Inactive icon: textMuted color
- Icon size: 24px
- Label: 11px, 500 weight
- Height: 56px (mobile), full height (desktop sidebar)
- Active indicator: pill-shaped accent bg behind icon (Material 3 style)
- Badge dots: small red circle for notification counts
```

## Toast / Notification System

**Replace all `Alert.alert` and `window.alert` with a unified toast system.**

### Toast Types
```
Success:  ┌──────────────────────────────┐
          │  ✓  Changes saved            │  ← Green left accent bar
          └──────────────────────────────┘

Error:    ┌──────────────────────────────┐
          │  ✕  Failed to save           │  ← Red left accent bar
          │     [Retry]                  │
          └──────────────────────────────┘

Info:     ┌──────────────────────────────┐
          │  ℹ  Syncing calendar...      │  ← Blue left accent bar
          └──────────────────────────────┘

Warning:  ┌──────────────────────────────┐
          │  ⚠  Connection unstable      │  ← Orange left accent bar
          └──────────────────────────────┘
```

### Toast Behavior
- Position: top of screen (below safe area), centered
- Width: min(480px, 90vw)
- Enter: slide down from top + fade in (spring, 300ms)
- Exit: slide up + fade out (200ms)
- Auto-dismiss: 3s (success/info), 5s (warning), persistent (error, until dismissed or action taken)
- Swipe up to dismiss
- Stack: max 3 visible, oldest auto-dismisses when 4th arrives
- Background: bg.secondary with 4px colored left border
- Border radius: 12px
- Shadow: md elevation
- Haptic: light impact on appear (native)

### Confirmation Dialogs
Replace `window.confirm` with styled modal:
```
┌─────────────────────────────────┐
│                                 │
│  Disconnect Email?              │  ← h2, bold
│                                 │
│  Your cached messages will be   │  ← body, secondary text
│  permanently deleted.           │
│                                 │
│  [Cancel]          [Disconnect] │  ← Ghost btn / Danger btn
│                                 │
└─────────────────────────────────┘

- Centered on screen with overlay backdrop
- Background: bg.secondary
- Border radius: 20px
- Max width: 400px
- Buttons: right-aligned, destructive action on the right
- Enter: scale 0.95 → 1.0 + fade, spring
- Backdrop: fade in 200ms
```

## Electron Title Bar

### Custom Title Bar (macOS)
```
┌─────────────────────────────────────────────┐
│  🔴 🟡 🟢      WorkTracker         ─ □ ✕   │
│─────────────────────────────────────────────│

- Draggable region for window move
- Traffic lights (macOS): inset 12px from left, vertically centered
- Title: centered, caption size, secondary text color
- Background: bg.primary (blends with app)
- Height: 32px
- On macOS: use titleBarStyle: 'hiddenInset' for native traffic lights
- On Windows: custom minimize/maximize/close buttons in accent style
- Frameless on all platforms for clean look
```

### Window Controls Styling (Windows/Linux)
```
─ (minimize): ghost button, hover bg.tertiary
□ (maximize): ghost button, hover bg.tertiary
✕ (close): ghost button, hover error color bg
All: 46x32px hit targets
```

## Web Scrollbar Styling

```css
/* Thin, dark scrollbars that match the theme */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);  /* dark mode */
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Light mode */
[data-theme="light"] ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}

[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Auto-hide: only show on scroll, fade out after 1s idle */
/* Firefox: scrollbar-width: thin; scrollbar-color: ... */
```

## Empty States (All Screens)

Every screen needs a designed empty state. No blank white/black screens.

### Pattern
```
┌─────────────────────────────────┐
│                                 │
│           [Illustration]        │  ← Simple line icon, 64px, textMuted color
│                                 │
│        No entries yet           │  ← h2, primary text
│                                 │
│    Start tracking time to see   │  ← body, secondary text
│    your history here.           │
│                                 │
│        [Start Timer]            │  ← Primary button (accent)
│                                 │
└─────────────────────────────────┘
```

### Per-Screen Empty States

| Screen | Icon | Title | Subtitle | Action |
|--------|------|-------|----------|--------|
| **History** | Clock | No entries yet | Start tracking time to see your history here | [Start Timer] |
| **Analytics** | Chart | No data yet | Track some time this week to see your analytics | [Start Timer] |
| **Categories** | Folder | No categories | Create categories to organize your time entries | [Create Category] |
| **Goals** | Flag | No goals set | Set monthly goals to track your progress | [Set a Goal] |
| **Notes** | Notepad | No notes | Create your first note to get started | [New Note] |
| **Tasks** | Checkbox | All clear! | You have no tasks. Enjoy your free time | [Add Task] |

### Empty State Animation
- Icon: gentle float animation (translateY ±4px, 3s loop, ease-in-out)
- Content: fade in on mount (300ms)
- Button: slight pulse on first appearance to draw attention (scale 1.0 → 1.03 → 1.0, once)

## Dark/Light Mode Transition

**Animated transition, not instant swap.**

```typescript
// When theme changes:
// 1. Capture current screen as a snapshot (react-native-view-shot on native, CSS on web)
// 2. Overlay snapshot on top of the real UI
// 3. Apply new theme colors to real UI (underneath)
// 4. Fade out snapshot: opacity 1 → 0, 400ms ease
// Result: smooth cross-fade between themes

// Web alternative (simpler):
// Use CSS transition on all color properties:
// * { transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease; }
// Toggle data-theme attribute on <html>

// If reduce-motion is on: instant swap (no animation)
```

## Context Menus (Web/Desktop)

**Custom right-click menus for interactive elements.**

### Style
```
┌─────────────────────┐
│  Edit            ⌘E │  ← 36px row height
│  Duplicate       ⌘D │
│  ───────────────── │  ← Divider
│  Delete          ⌫  │  ← Error color text
└─────────────────────┘

- Background: bg.secondary
- Border: 1px border color
- Border radius: 10px
- Shadow: lg elevation
- Min width: 180px
- Hover: bg.tertiary on row
- Appear: scale 0.95 → 1.0 + fade, 100ms
- Disappear: fade out 100ms
- Keyboard shortcut labels: right-aligned, textMuted
```

### Where Context Menus Apply
| Element | Menu Items |
|---------|------------|
| **Time entry** (History) | Edit, Duplicate, Delete |
| **Category** | Edit, Change Color, Delete |
| **Goal** | Edit, Reset Progress, Delete |
| **Widget** (Hub edit mode) | Configure, Resize, Hide |
| **Note** | Edit, Pin/Unpin, Delete |
| **Task** | Edit, Mark Complete, Delete |

## Tooltips (Web/Desktop)

**For icon-only buttons, truncated text, and info hints.**

### Style
```
         Tooltip text here
         ┌──────────────────┐
         │ Export as CSV     │
         └────────▼─────────┘
              [📥]  ← Icon button

- Background: bg.primary (inverted feel — white on dark, dark on light)
- Text: text.inverse, caption size (14px)
- Border radius: 8px
- Padding: 6px 12px
- Arrow: 6px CSS triangle pointing to trigger element
- Max width: 240px
- Shadow: sm elevation
```

### Behavior
- Show after 500ms hover delay (prevents flicker on mouse traversal)
- Fade in: 150ms
- Fade out: 100ms
- Position: prefer top, fallback to bottom/left/right based on viewport
- Touch devices: never show (rely on long-press or labels instead)
- Keyboard: show on focus for icon-only buttons

### Where Tooltips Apply
- All icon-only buttons (filter, export, settings gear, etc.)
- Truncated text (ellipsis) — show full text on hover
- Info (ℹ) icons next to settings labels
- Chart data points — show exact values on hover
- Tab bar icons on desktop sidebar (when collapsed to icon-only mode)

## Accessibility

- All interactive elements: minimum 48x48px touch target
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Screen reader labels on all widgets and actions
- Keyboard navigation support on web/desktop
- Reduce motion: honor system preference, disable all animations
- Focus ring: 2px accent outline, 2px offset, visible on keyboard nav only (not mouse click)
- Skip to content link (web): hidden until Tab key pressed
- ARIA labels on all icon-only buttons
- ARIA live regions for toast notifications
- Role attributes on custom components (menu, dialog, tablist, etc.)
- Prefers-contrast: high — increase border widths and text weights
