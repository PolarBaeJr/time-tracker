# Electron Desktop Build Guide

This guide covers building, packaging, and distributing the WorkTracker desktop application using Electron.

## Prerequisites

Before building the Electron app, ensure you have the following installed:

- Node.js 18+ and npm
- For macOS builds: Xcode Command Line Tools (`xcode-select --install`)
- For Windows builds: Visual Studio Build Tools (if building on Windows)
- For Linux builds: Required dependencies vary by distribution

## Installation

Install the required development dependencies:

```bash
npm install
```

This installs:
- `electron` - The Electron framework
- `electron-builder` - Packaging and distribution tool
- `concurrently` - For running multiple processes during development

## Development

Run the Electron app in development mode:

```bash
npm run electron:dev
```

This runs:
1. Expo web server (for hot reloading)
2. Electron process pointing to the local dev server

The app will automatically reload when you make changes to the React Native/web code.

## Building

### Build Web + Compile Electron

```bash
npm run electron:build
```

This:
1. Exports the web build using Expo (`npm run build:web`)
2. Compiles Electron TypeScript files (`tsc -p electron/tsconfig.json`)

### Package for Distribution

Package for all platforms (current platform only):

```bash
npm run electron:package
```

Package for specific platforms:

```bash
# macOS only
npm run electron:package:mac

# Windows only (requires Windows or Wine on other platforms)
npm run electron:package:win

# Linux only
npm run electron:package:linux
```

Build outputs are placed in the `electron-dist/` directory.

## Distribution Formats

### macOS
- **DMG** - Standard macOS disk image installer
- **ZIP** - Compressed app bundle for manual installation

Architectures: Intel (x64) and Apple Silicon (arm64)

### Windows
- **NSIS Installer** - Standard Windows installer with customizable installation directory
- **Portable** - Standalone executable, no installation required

Architecture: x64

### Linux
- **AppImage** - Universal Linux package, runs on most distributions
- **DEB** - Debian/Ubuntu package

Architectures: x64 and arm64

## Code Signing

### macOS Code Signing

For distribution outside the Mac App Store, you need to sign your app with a Developer ID certificate.

#### Prerequisites

1. Enroll in the Apple Developer Program ($99/year)
2. Create a "Developer ID Application" certificate in Xcode or the Apple Developer portal
3. Install the certificate in your Keychain

#### Environment Variables

Set these environment variables before running `electron:package:mac`:

```bash
# Required for signed builds
export CSC_LINK="/path/to/developer-id-certificate.p12"
export CSC_KEY_PASSWORD="your-certificate-password"

# Or use Keychain identity name
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
```

#### Notarization (Recommended)

Apple requires notarization for apps distributed outside the App Store (macOS 10.15+).

1. Create an app-specific password at appleid.apple.com
2. Set environment variables:

```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

3. Add notarize configuration to electron-builder.yml:

```yaml
afterSign: scripts/notarize.js
```

4. Create `scripts/notarize.js`:

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;

  await notarize({
    appBundleId: 'com.worktracker.desktop',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

#### Self-Signed Development Builds

For local testing without an Apple Developer account:

1. The app will build without code signing by default
2. When opening, right-click the app and select "Open" to bypass Gatekeeper
3. Or run: `xattr -cr /Applications/WorkTracker.app`

### Windows Code Signing

For Windows distribution, code signing prevents security warnings.

#### Using a Code Signing Certificate

```bash
export WIN_CSC_LINK="/path/to/code-signing-certificate.pfx"
export WIN_CSC_KEY_PASSWORD="your-certificate-password"
```

#### Self-Signed for Development

Without a certificate, Windows will show SmartScreen warnings. Users can click "More info" → "Run anyway".

## Troubleshooting

### Build Errors

**"electron is not defined"**
- Ensure electron is installed: `npm install electron --save-dev`

**"Cannot find module 'electron-builder'"**
- Install electron-builder: `npm install electron-builder --save-dev`

**TypeScript compilation errors in electron/**
- Run: `npm run electron:compile` to see specific errors
- The electron directory has its own tsconfig.json

### Runtime Errors

**Blank white screen**
- Check that the web build exists: `ls dist/`
- Ensure the file path in electron/main.ts is correct
- Check DevTools console for JavaScript errors (View → Toggle Developer Tools)

**Authentication issues**
- Verify Supabase URL and keys are correctly configured
- Check Content Security Policy in electron/main.ts allows your OAuth providers

**App crashes on launch**
- Check electron logs in terminal
- On macOS, check Console.app for crash reports

### Platform-Specific Issues

**macOS: "App is damaged and can't be opened"**
- The app is not signed or notarized
- Run: `xattr -cr /path/to/WorkTracker.app`

**Windows: SmartScreen blocks the app**
- The app is not signed with a valid certificate
- Click "More info" → "Run anyway" for testing

**Linux: AppImage doesn't run**
- Make it executable: `chmod +x WorkTracker.AppImage`
- Install FUSE if required: `sudo apt install fuse`

## Security Considerations

The Electron configuration follows security best practices:

- **Context Isolation**: Enabled - renderer process cannot access Node.js directly
- **Node Integration**: Disabled - prevents XSS attacks from running system commands
- **Sandbox**: Enabled - renderer processes run in a sandboxed environment
- **Content Security Policy**: Restricts resource loading to trusted sources
- **Secure Preload**: Only safe APIs are exposed via contextBridge

See `electron/main.ts` for the security configuration.

## File Structure

```
electron/
├── main.ts              # Main process entry point
├── preload.ts           # Preload script for contextBridge
├── tsconfig.json        # TypeScript config for Electron
├── electron-builder.yml # Build and packaging configuration
└── entitlements.mac.plist  # macOS code signing entitlements

docs/
└── ELECTRON_BUILD.md    # This file

electron-dist/           # Build output (gitignored)
├── mac-arm64/
├── mac-x64/
├── win-unpacked/
└── linux-unpacked/
```

## CI/CD Integration

For automated builds, set environment variables in your CI system:

```yaml
# GitHub Actions example
env:
  CSC_LINK: ${{ secrets.MAC_CERTIFICATE_P12_BASE64 }}
  CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

See `.github/workflows/` for CI configuration examples.
