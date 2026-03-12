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

## 7. Email and Calendar Integration Setup

### Database Migrations

The email and calendar integration requires additional tables. Apply these migrations:

```bash
# Apply all migrations (includes email and calendar tables)
supabase db push
```

Key migrations for email/calendar:
- `20240101000025_add_email_connections.sql` - Email connections and messages tables
- `20240101000026_add_calendar_connections.sql` - Calendar connections and events tables

These migrations create:
- `email_connections` - OAuth tokens for Gmail/Outlook and IMAP credentials
- `email_messages` - Cached email messages
- `calendar_connections` - OAuth tokens for Google Calendar/Outlook Calendar
- `calendar_events` - Cached calendar events

All tables have RLS policies that restrict access to the owning user.

### Edge Function Deployment

Deploy the email-sync and calendar-sync Edge Functions:

```bash
# Deploy all Edge Functions
supabase functions deploy

# Or deploy individually
supabase functions deploy email-sync
supabase functions deploy calendar-sync
```

### Edge Function Secrets

The Edge Functions require secrets for token encryption and OAuth refresh:

```bash
# Generate a secure encryption key
openssl rand -base64 32

# Set required secrets
supabase secrets set ENCRYPTION_KEY="your-generated-encryption-key"
supabase secrets set GOOGLE_CLIENT_ID="your-google-oauth-client-id"
supabase secrets set MICROSOFT_CLIENT_ID="your-microsoft-oauth-client-id"

# Verify secrets are set
supabase secrets list
```

**Important:** The `ENCRYPTION_KEY` is used to encrypt OAuth tokens before storing them in the database. Use the same key across all environments where you want to share token data.

### OAuth Redirect URIs for Email/Calendar

Add these redirect URIs to your OAuth provider configurations:

**Google Cloud Console (for Gmail & Google Calendar):**
- `http://localhost:8081/email/gmail/callback` (development)
- `http://localhost:8081/calendar/google/callback` (development)
- `https://your-app.com/email/gmail/callback` (production)
- `https://your-app.com/calendar/google/callback` (production)

**Azure Portal (for Outlook Email & Calendar):**
- `http://localhost:8081/email/outlook/callback` (development)
- `http://localhost:8081/calendar/outlook/callback` (development)
- `https://your-app.com/email/outlook/callback` (production)
- `https://your-app.com/calendar/outlook/callback` (production)

### Testing the Integration

1. Start the app and navigate to Settings
2. Connect an email account (Gmail or Outlook)
3. Verify the OAuth flow completes and redirects back to the app
4. Check the Hub screen for the Email widget
5. Repeat for Calendar integration

### Troubleshooting

**"Server encryption not configured" error:**
- Ensure `ENCRYPTION_KEY` is set in Supabase secrets
- The key must be at least 32 characters (base64 encoded)

**"Token refresh failed" error:**
- Verify `GOOGLE_CLIENT_ID` or `MICROSOFT_CLIENT_ID` secrets match your OAuth app
- Check that the OAuth app has the required scopes enabled

**"Sync cooldown" error:**
- The sync endpoints enforce a 5-minute cooldown between syncs
- This prevents API rate limiting from Google/Microsoft
