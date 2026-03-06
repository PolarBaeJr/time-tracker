# Deep Linking Configuration

This document describes how to configure deep linking for the WorkTracker app on iOS and Android. Deep linking enables the app to handle OAuth callbacks and custom URLs.

## Overview

WorkTracker supports two types of deep links:

1. **Custom URL Scheme**: `worktracker://`
   - Used primarily for OAuth callbacks on native platforms
   - Example: `worktracker://auth/callback?code=abc123`

2. **Universal Links (HTTPS)**: `https://worktracker.app/`
   - Used for web and native app links
   - Example: `https://worktracker.app/auth/callback?code=abc123`

## OAuth Callback Flow

The OAuth flow uses PKCE (Proof Key for Code Exchange) for security:

1. User taps "Sign in with Google"
2. App opens browser with OAuth request
3. User authenticates with Google
4. Google redirects to Supabase callback
5. Supabase redirects to app callback URL with authorization code
6. App exchanges code for session tokens using `exchangeCodeForSession()`
7. User is signed in

**Security Note**: The callback URL contains an authorization code, NOT tokens directly. The `useDeepLink` hook handles the secure exchange of this code for session tokens.

## iOS Configuration

### 1. URL Scheme (Custom URL)

The URL scheme is configured in `app.json`:

```json
{
  "expo": {
    "scheme": "worktracker"
  }
}
```

This allows the app to handle `worktracker://` URLs.

### 2. Associated Domains (Universal Links)

To enable Universal Links (`https://worktracker.app/`), configure Associated Domains in your Apple Developer account and Xcode.

#### Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Certificates, IDs & Profiles** > **Identifiers**
3. Select your App ID (`com.worktracker.app`)
4. Enable **Associated Domains** capability
5. Save changes

#### Server Configuration

Host an `apple-app-site-association` file at `https://worktracker.app/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.worktracker.app",
        "paths": ["/auth/callback", "/entry/*"]
      }
    ]
  }
}
```

Replace `TEAM_ID` with your Apple Developer Team ID.

#### Expo Configuration

Add to `app.json` under `expo.ios`:

```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:worktracker.app"]
    }
  }
}
```

### 3. Google Sign-In iOS URL Scheme

For Google Sign-In, add the reversed client ID to `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLName": "google-signin",
            "CFBundleURLSchemes": ["com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"]
          }
        ]
      }
    }
  }
}
```

Replace `YOUR_IOS_CLIENT_ID` with your Google OAuth iOS client ID.

## Android Configuration

### 1. Intent Filters (Custom URL and HTTPS)

Intent filters are configured in `app.json`:

```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "worktracker",
              "host": "auth",
              "pathPrefix": "/callback"
            },
            {
              "scheme": "https",
              "host": "worktracker.app",
              "pathPrefix": "/auth/callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

This configuration:
- Handles `worktracker://auth/callback` (custom scheme)
- Handles `https://worktracker.app/auth/callback` (App Links)
- `autoVerify: true` enables automatic App Link verification

### 2. App Links Verification (Android App Links)

To verify App Links, host a Digital Asset Links file at `https://worktracker.app/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.worktracker.app",
      "sha256_cert_fingerprints": [
        "YOUR_APP_SIGNING_CERTIFICATE_SHA256"
      ]
    }
  }
]
```

Get your SHA256 fingerprint:
```bash
# For debug builds
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256

# For release builds (using EAS)
eas credentials --platform android
```

## Supabase Configuration

### Redirect URLs

Configure allowed redirect URLs in your Supabase project:

1. Go to **Supabase Dashboard** > **Authentication** > **URL Configuration**
2. Add these to **Redirect URLs**:
   - `worktracker://auth/callback`
   - `https://worktracker.app/auth/callback`
   - `http://localhost:19006/auth/callback` (for development)

### Google OAuth Provider

1. Go to **Authentication** > **Providers** > **Google**
2. Enable Google provider
3. Add your Google OAuth Client ID and Secret
4. Ensure the Google Cloud Console has the correct redirect URI:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

## Usage in Code

### Basic Usage

The `useDeepLink` hook handles OAuth callbacks automatically:

```typescript
import { useDeepLink } from '@/hooks';

function App() {
  const { isProcessing, error } = useDeepLink({
    onSuccess: () => {
      // User is now signed in
      console.log('Sign in successful!');
    },
    onError: (error) => {
      console.error('Sign in failed:', error.message);
    },
  });

  if (isProcessing) {
    return <LoadingScreen message="Completing sign in..." />;
  }

  return <MainApp />;
}
```

### With React Navigation

When using React Navigation, the linking configuration is already set up:

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { linking } from '@/lib/linking';

function App() {
  return (
    <NavigationContainer linking={linking}>
      <AppNavigator />
    </NavigationContainer>
  );
}
```

### Manual URL Handling

To manually handle a deep link URL:

```typescript
const { handleDeepLink } = useDeepLink();

// When you receive a URL from navigation params or elsewhere
await handleDeepLink('worktracker://auth/callback?code=abc123');
```

## Supported Routes

| URL Pattern | Screen | Description |
|-------------|--------|-------------|
| `/auth/callback` | AuthCallback | OAuth callback handler |
| `/login` | Login | Login screen |
| `/timer` | Timer | Timer screen (in Main tabs) |
| `/history` | History | History screen (in Main tabs) |
| `/entry/:entryId` | EntryEdit | Edit a specific time entry |

## Troubleshooting

### iOS Issues

**URL scheme not working:**
- Rebuild the app after changing `app.json`
- Check that the scheme matches exactly (case-sensitive)
- For Expo Go, use `exp://` scheme instead

**Universal Links not working:**
- Verify the `apple-app-site-association` file is accessible
- Check the file is served with `Content-Type: application/json`
- Wait for Apple's CDN to update (can take up to 24 hours)
- Test with `npx uri-scheme open https://worktracker.app/auth/callback --ios`

### Android Issues

**Deep links not opening in app:**
- Rebuild the app after changing `app.json`
- Clear app defaults: Settings > Apps > WorkTracker > Open by default > Clear defaults
- Test with `adb shell am start -a android.intent.action.VIEW -d "worktracker://auth/callback"`

**App Links verification failing:**
- Verify `assetlinks.json` is accessible at the correct URL
- Check SHA256 fingerprint matches your signing certificate
- Use Google's [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator)

### OAuth Callback Issues

**Code exchange failing:**
- Verify the authorization code hasn't expired (codes are single-use and expire quickly)
- Check Supabase redirect URL configuration
- Ensure PKCE flow is being used (`flowType: 'pkce'` in Supabase client)

**Session not being created:**
- Check the browser console or app logs for errors
- Verify Supabase anon key is correct
- Ensure the user profile exists in `public.users` table

## Testing Deep Links

### iOS Simulator

```bash
# Custom URL scheme
npx uri-scheme open worktracker://auth/callback --ios

# Universal Link (requires app to be installed)
xcrun simctl openurl booted "https://worktracker.app/auth/callback?code=test"
```

### Android Emulator

```bash
# Custom URL scheme
adb shell am start -a android.intent.action.VIEW -d "worktracker://auth/callback?code=test"

# App Link
adb shell am start -a android.intent.action.VIEW -d "https://worktracker.app/auth/callback?code=test"
```

### Web

Navigate directly to the callback URL in your browser:
```
http://localhost:19006/auth/callback?code=test
```

## Security Considerations

1. **Never pass tokens in URLs** - The callback URL contains an authorization code, not tokens
2. **Codes are single-use** - Authorization codes expire quickly and can only be exchanged once
3. **Use PKCE** - The Supabase client is configured with PKCE for public client security
4. **Validate redirect URLs** - Only allow known redirect URLs in Supabase configuration
5. **Secure storage** - Tokens are stored securely (SecureStore on native, localStorage on web)

## Related Documentation

- [Supabase Setup](./SUPABASE_SETUP.md) - Configure Supabase authentication
- [Mobile Build](./MOBILE_BUILD.md) - Build native apps with EAS
- [Expo Deep Linking](https://docs.expo.dev/guides/deep-linking/)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)
