# Mobile Build Setup

WorkTracker uses Expo Application Services (EAS) for iOS and Android builds. The build profiles live in [`eas.json`](../eas.json), while [`app.config.js`](../app.config.js) injects environment variables into `expo.extra` at build time.

## Prerequisites

1. Install dependencies with `npm install`.
2. Install the EAS CLI globally or invoke it with `npx`.
3. Sign in to Expo with `eas login`.
4. Link the app to an Expo project and capture the project ID.

## Required environment variables

Define these values locally for development and in each EAS environment (`development`, `preview`, `production`) before starting a cloud build:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
GOOGLE_IOS_REVERSED_CLIENT_ID=com.googleusercontent.apps.your-reversed-client-id
EAS_PROJECT_ID=your-eas-project-id
```

Notes:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into `expo.extra`, which is what the app reads at runtime.
- `GOOGLE_IOS_REVERSED_CLIENT_ID` overrides the placeholder URL scheme used for iOS Google sign-in.
- `EAS_PROJECT_ID` keeps the app linked to the correct Expo project without hardcoding a real project ID in git.

## Build profiles

- `development`: Internal development client build for local QA.
- `preview`: Internal distribution build for stakeholders and device testing.
- `production`: Store-ready build with remote app version management enabled.

Each profile maps to a same-named EAS environment in `eas.json`. Store the secrets in those EAS environments instead of committing them inline.

## Build commands

Use the existing package scripts for platform-specific builds:

```bash
npm run build:ios -- --profile development
npm run build:ios -- --profile preview
npm run build:ios -- --profile production

npm run build:android -- --profile development
npm run build:android -- --profile preview
npm run build:android -- --profile production
```

For web verification, export the Metro web bundle locally:

```bash
npm run build:web
```

## OAuth and deep linking

- Native OAuth callbacks use `worktracker://auth/callback`.
- Android intent filters already cover both `worktracker://auth/callback` and `https://worktracker.app/auth/callback`.
- iOS Google sign-in uses `GOOGLE_IOS_REVERSED_CLIENT_ID` to populate `CFBundleURLTypes` during build.

## Recommended release flow

1. Set or update the variables in the target EAS environment.
2. Verify the resolved Expo config with `npx expo config --type public`.
3. Build a `preview` binary for device validation.
4. Promote to the `production` profile once auth, Supabase connectivity, and deep links are confirmed.
