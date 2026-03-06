# WorkTracker App Assets

This directory contains the visual assets for the WorkTracker app, including app icons, splash screens, and favicons.

## Asset Files

| File | Dimensions | Purpose |
|------|------------|---------|
| `icon.png` | 1024x1024 | Main app icon for iOS and general use |
| `splash.png` | 1284x2778 | Full splash screen image |
| `splash-icon.png` | 1024x1024 | Splash screen icon (legacy) |
| `android-icon-foreground.png` | 1024x1024 | Android adaptive icon foreground layer |
| `android-icon-background.png` | 1024x1024 | Android adaptive icon background layer |
| `android-icon-monochrome.png` | 1024x1024 | Android monochrome icon for themed icons |
| `favicon.png` | 48x48 | Web favicon |

## Design System

### Colors

The assets use the WorkTracker dark theme color palette:

- **Background**: `#0F0F0F` (dark black)
- **Primary**: `#6366F1` (indigo) - main brand color
- **Secondary**: `#22D3EE` (cyan) - accent color
- **Text**: `#FFFFFF` (white)

### Icon Design

The WorkTracker icon represents a clock/timer with a play button, symbolizing work time tracking:

- Circular clock face outline in primary indigo color
- Four clock markers at 12, 3, 6, and 9 o'clock positions
- Play triangle in the center (representing start/timer functionality)
- Dark background matching the app theme

### Android Adaptive Icons

Android adaptive icons use a two-layer system:
- **Foreground**: The icon design (clock + play) on transparent background
- **Background**: Solid dark background (`#0F0F0F`)
- **Monochrome**: White version for themed icons (Android 13+)

The foreground layer respects the 66% safe zone required by Android.

## Regenerating Assets

Assets can be regenerated using the included Node.js script:

```bash
node scripts/generate-assets.js
```

This script generates all PNG files programmatically using the app's theme colors.

## Replacing with Professional Assets

To replace these assets with professionally designed versions:

1. **Main Icon** (`icon.png`)
   - Size: 1024x1024 pixels
   - Format: PNG with transparency support
   - No padding needed (Expo handles platform-specific masking)

2. **Splash Screen** (`splash.png`)
   - Size: 1284x2778 pixels (iPhone 14 Pro Max)
   - Background color should match: `#0F0F0F`
   - Center the logo/icon in the middle
   - Keep important content within the center 60% to be safe on all devices

3. **Android Adaptive Icons**
   - Foreground: 1024x1024, transparent background
   - Keep design within center 66% (safe zone)
   - Background: 1024x1024, can be solid color or pattern
   - Monochrome: 1024x1024, white on transparent

4. **Favicon** (`favicon.png`)
   - Size: 48x48 pixels (or provide 192x192 for high DPI)
   - Simple, recognizable design at small sizes

## Design Tools

For creating professional assets, consider:

- **Figma** - Free, collaborative design tool
- **Sketch** - macOS design tool
- **Adobe Illustrator** - Vector graphics
- **Affinity Designer** - Professional vector graphics

### Figma Template Suggestions

1. Create a 1024x1024 artboard for the icon
2. Use the color tokens from `src/theme/colors.ts`
3. Export at 1x for all PNG files
4. For splash, create a 1284x2778 artboard

## Configuration

Assets are configured in `app.json`:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0F0F0F"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png",
        "backgroundColor": "#0F0F0F"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## Splash Screen Behavior

The app uses `expo-splash-screen` to control splash visibility:

1. Native splash screen shows immediately on app launch
2. Splash remains visible while:
   - Auth check completes (session verification)
   - Minimum 500ms display time passes
3. Splash fades out once app is ready

This is implemented in `src/hooks/useSplashScreen.ts` and integrated in `App.tsx`.

## Testing

To test icons on different platforms:

```bash
# Start development server
npm start

# Test on iOS Simulator
npm run ios

# Test on Android Emulator
npm run android

# Test web favicon
npm run web
```

For production icon testing, use EAS Build:

```bash
# Build preview for internal testing
eas build --profile preview --platform all
```
