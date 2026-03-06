# Supabase and Google OAuth Setup

WorkTracker uses Supabase Auth with Google as the OAuth provider and a PKCE client flow in Expo. Google redirects back to Supabase first. Supabase then redirects to the app's web callback or the native deep link.

## 1. Create the Supabase project

1. Create a new project in the Supabase Dashboard.
2. Open `Settings > API`.
3. Copy the project URL and anon key into your local `.env` file:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are used for local Supabase CLI auth and should match the values you enter in the hosted Supabase dashboard.

## 2. Create Google OAuth credentials

1. Open Google Auth Platform in Google Cloud Console.
2. Configure the consent screen for your organization or external users.
3. Create an OAuth client with application type `Web application`.
4. Add authorized JavaScript origins for each web origin that will start sign-in:
   - `http://localhost:8081`
   - `http://localhost:19006`
   - Your production web origin, for example `https://app.worktracker.example`
5. Add authorized redirect URIs for Supabase callbacks:
   - Hosted Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Local Supabase CLI: `http://127.0.0.1:54321/auth/v1/callback`
6. Save the client ID and client secret.

Important details:

- Do not register `worktracker://auth/callback` in Google Cloud Console. Google redirects to Supabase, not directly to the app deep link.
- Do not reference the deprecated Google+ API.
- No extra Google API is required for basic sign-in. If you later need additional Google profile data beyond the basic identity claims, enable Google People API separately.

## 3. Enable Google in Supabase

1. Open `Authentication > Providers > Google` in the Supabase Dashboard.
2. Enable the provider.
3. Paste the Google client ID and client secret from the previous step.
4. Open `Authentication > URL Configuration`.
5. Set the Site URL to your primary web app origin.
   - Local example: `http://localhost:8081`
   - Production example: `https://app.worktracker.example`
6. Add redirect URLs for every callback target the app will use:
   - `http://localhost:8081/auth/callback`
   - `http://localhost:19006/auth/callback`
   - `worktracker://auth/callback`
   - Your production web callback, for example `https://app.worktracker.example/auth/callback`

Supabase uses this allow-list after it finishes the provider callback and exchanges the authorization code for a session.

## 4. Local Supabase CLI configuration

This repository includes [`supabase/config.toml`](../supabase/config.toml) with local auth settings for Google OAuth.

Key settings:

- `auth.site_url` is set to `http://localhost:8081`
- `auth.additional_redirect_urls` includes web callbacks plus `worktracker://auth/callback`
- `auth.external.google.client_id` reads from `GOOGLE_CLIENT_ID`
- `auth.external.google.secret` reads from `GOOGLE_CLIENT_SECRET`
- Local Google callback URL is `http://127.0.0.1:54321/auth/v1/callback`

After changing `supabase/config.toml`, restart the local stack:

```bash
supabase stop
supabase start
```

## 5. Mobile deep-link notes

- The Expo app already declares the `worktracker` scheme in [`app.json`](../app.json).
- Native OAuth should redirect to `worktracker://auth/callback`.
- That deep link must exist in the Supabase redirect allow-list, not in Google's redirect URI list.
- The app should pass `redirectTo=worktracker://auth/callback` when starting Google sign-in on native platforms.

## 6. Verification checklist

Before working on auth flows, confirm:

1. `.env` contains `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.
2. Google Cloud Console includes the Supabase hosted callback and the local CLI callback.
3. Supabase Google provider is enabled.
4. Supabase URL configuration includes the web callback URL and `worktracker://auth/callback`.
5. If you use the Supabase CLI locally, restart it after auth configuration changes.
