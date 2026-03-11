# 01 - Dashboard Hub (Widget Framework)

## Phase: 1 (Foundation)

## Summary

A new "Hub" tab in the bottom navigation that displays a customizable grid of widgets. Each widget is a self-contained card that can be reordered, resized, collapsed, or expanded to full view.

## UI Design

### Hub Tab Layout
```
+------------------------------------------+
|  Good morning, Matt          [Edit] [+]  |
+------------------------------------------+
| +------------------+ +------------------+ |
| |  Weather         | |  Next Event      | |
| |  72F Sunny       | |  Standup 10:00am | |
| +------------------+ +------------------+ |
| +---------------------------------------+ |
| |  Email Summary                    3   | |
| |  - Invoice from Acme (action needed)  | |
| |  - Meeting notes from Sarah           | |
| |  - Newsletter digest                  | |
| +---------------------------------------+ |
| +---------------------------------------+ |
| |  Today's Tasks                   5/8  | |
| |  [x] Review PR #42                   | |
| |  [ ] Write API docs                  | |
| |  [ ] Call dentist                     | |
| +---------------------------------------+ |
| +------------------+ +------------------+ |
| |  Quick Links     | |  AI Chat         | |
| |  GitHub  Figma   | |  Ask anything... | |
| +------------------+ +------------------+ |
+------------------------------------------+
```

### Widget System Architecture

```
src/
  components/
    hub/
      HubScreen.tsx           # Main hub screen
      WidgetGrid.tsx          # Responsive grid layout
      WidgetCard.tsx          # Base widget card (header, collapse, expand)
      WidgetRegistry.ts       # Registry of available widgets
      widgets/
        WeatherWidget.tsx
        EmailWidget.tsx
        CalendarWidget.tsx
        TasksWidget.tsx
        QuickLinksWidget.tsx
        AIChatWidget.tsx
        NewsWidget.tsx
        SlackWidget.tsx
        DiscordWidget.tsx
        ClipboardWidget.tsx
        SpotifyWidget.tsx     # Move existing mini player into widget
  hooks/
    useWidgetLayout.ts        # Widget positions/sizes/visibility
    useHubGreeting.ts         # Time-aware greeting
  stores/
    hubStore.ts               # Widget layout preferences
```

### Widget Interface

```typescript
interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  icon: string;
  defaultSize: 'small' | 'medium' | 'large';  // 1x1, 2x1, 2x2
  minSize: 'small' | 'medium' | 'large';
  resizable: boolean;
  requiresAuth: string | null;  // e.g., 'gmail', 'slack', null
}

interface WidgetProps {
  config: WidgetConfig;
  size: 'small' | 'medium' | 'large';
  onExpand: () => void;        // Full-screen view
  onConfigure: () => void;     // Widget settings
}
```

### Widget Layout Storage

Layout stored in user `preferences` JSONB (existing pattern):

```json
{
  "hub_layout": {
    "widgets": [
      { "id": "weather-1", "type": "weather", "position": 0, "size": "small", "visible": true },
      { "id": "email-1", "type": "email", "position": 1, "size": "large", "visible": true },
      { "id": "calendar-1", "type": "calendar", "position": 2, "size": "medium", "visible": true }
    ]
  }
}
```

### Edit Mode

- Long-press or tap [Edit] button enters edit mode
- Widgets jiggle (iOS-style) with drag handles
- Drag to reorder, pinch to resize (desktop: resize handles)
- Tap [-] to hide, [+] button shows available widgets to add
- Preferences synced to Supabase via existing sync mechanism

## Navigation Changes

```
MainTabs (bottom tab navigator)
├── Hub          ← NEW (replaces Timer as default tab)
├── Timer
├── History
├── Analytics
├── Categories
├── Goals
├── Settings
```

Timer remains accessible as its own tab. The Hub optionally shows a timer summary widget.

## Responsive Design

- **Mobile**: Single column, widgets stack vertically
- **Tablet**: 2-column grid
- **Desktop (Electron/Web)**: 3-column grid with sidebar option
- Widget sizes adapt: "small" = 1 column, "medium" = 1 column on mobile / 1 on desktop, "large" = full width

## Key Implementation Notes

- Use `react-native-reanimated` for drag-and-drop (already an Expo dependency)
- Widget data fetching is independent per widget (each uses its own TanStack Query hook)
- Lazy-load widget content (only fetch data for visible widgets)
- Error boundaries per widget (one widget crash doesn't take down the hub)
- Skeleton loading states per widget
