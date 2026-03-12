/**
 * Edge Function: calendar-sync
 *
 * Synchronizes calendar events from connected providers (Google Calendar, Outlook).
 * Fetches events from the provider API and stores them in the calendar_events table.
 *
 * Authentication: Requires valid Supabase JWT
 * Method: POST
 * Body: { connectionId: string, dateRange?: { start: string; end: string } }
 * Returns: { success: true, eventCount: number } or { error: string }
 *
 * Security:
 * - Verifies user owns the connection before syncing
 * - Tokens are decrypted server-side using per-user key derivation
 * - Refresh tokens are used if access token is expired
 * - Rate limiting via sync cooldown (5 minutes)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptApiKey, encryptApiKey, isEncryptionConfigured } from '../_shared/crypto.ts';
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Google OAuth token URL */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Microsoft OAuth token URL */
const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/** Google Calendar API base URL */
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/** Microsoft Graph API base URL */
const OUTLOOK_API_BASE = 'https://graph.microsoft.com/v1.0';

/** Default number of days to fetch events for */
const DEFAULT_LOOKAHEAD_DAYS = 14;

/** Maximum events to fetch per sync */
const MAX_EVENTS_PER_SYNC = 100;

/** Sync cooldown in milliseconds (5 minutes) */
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// =============================================================================
// TYPES
// =============================================================================

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: 'google' | 'outlook';
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string | null;
  calendar_id: string | null;
  email_address: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  organizer?: { email: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

interface GoogleEventList {
  items?: GoogleEvent[];
  nextPageToken?: string;
}

interface OutlookEvent {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  isCancelled: boolean;
  showAs: string;
  organizer?: { emailAddress: { address: string; name?: string } };
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    status: { response: string };
  }>;
  location?: { displayName?: string };
  locations?: Array<{ displayName?: string }>;
  onlineMeetingUrl?: string | null;
}

interface OutlookEventList {
  '@odata.nextLink'?: string;
  value: OutlookEvent[];
}

interface CalendarEventRow {
  connection_id: string;
  provider_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  status: string | null;
  organizer: string | null;
  attendees: object | null;
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/**
 * Refresh Google OAuth access token
 */
async function refreshGoogleToken(refreshToken: string): Promise<OAuthTokens> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh Outlook OAuth access token
 */
async function refreshOutlookToken(refreshToken: string): Promise<OAuthTokens> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID') || '';

  const response = await fetch(OUTLOOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope:
        'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Outlook token refresh failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Check if token is expired and refresh if needed
 */
async function getValidAccessToken(
  connection: CalendarConnection,
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  // Decrypt tokens
  const accessToken = await decryptApiKey(connection.access_token_encrypted, userId);
  const refreshToken = await decryptApiKey(connection.refresh_token_encrypted, userId);

  // Check if token is expired (with 60 second buffer)
  if (connection.expires_at) {
    const expiresAt = new Date(connection.expires_at).getTime();
    const now = Date.now();

    if (now >= expiresAt - 60000) {
      // Token is expired or about to expire, refresh it
      let newTokens: OAuthTokens;

      if (connection.provider === 'google') {
        newTokens = await refreshGoogleToken(refreshToken);
      } else {
        newTokens = await refreshOutlookToken(refreshToken);
      }

      // Encrypt and store new tokens
      const encryptedAccessToken = await encryptApiKey(newTokens.access_token, userId);
      const encryptedRefreshToken = await encryptApiKey(newTokens.refresh_token, userId);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: newExpiresAt,
        })
        .eq('id', connection.id);

      return newTokens.access_token;
    }
  }

  return accessToken;
}

// =============================================================================
// GOOGLE CALENDAR SYNC
// =============================================================================

/**
 * Parse Google DateTime to ISO 8601 string
 */
function parseGoogleDateTime(dt: { dateTime?: string; date?: string }): string {
  if (dt.dateTime) {
    return dt.dateTime;
  }
  if (dt.date) {
    return `${dt.date}T00:00:00.000Z`;
  }
  return new Date().toISOString();
}

/**
 * Check if Google event is all-day
 */
function isGoogleAllDayEvent(event: GoogleEvent): boolean {
  return !event.start.dateTime && !!event.start.date;
}

/**
 * Map Google status to our schema
 */
function mapGoogleStatus(status: string | undefined): string | null {
  if (!status) return null;
  switch (status.toLowerCase()) {
    case 'confirmed':
      return 'confirmed';
    case 'tentative':
      return 'tentative';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

/**
 * Parse Google attendees
 */
function parseGoogleAttendees(attendees?: GoogleEvent['attendees']): object | null {
  if (!attendees || attendees.length === 0) return null;
  return attendees.map(a => ({
    email: a.email,
    name: a.displayName,
    status: a.responseStatus ?? 'needsAction',
  }));
}

/**
 * Sync events from Google Calendar
 */
async function syncGoogleCalendarEvents(
  accessToken: string,
  connectionId: string,
  calendarId: string,
  dateRange: { start: string; end: string }
): Promise<CalendarEventRow[]> {
  const params = new URLSearchParams({
    timeMin: dateRange.start,
    timeMax: dateRange.end,
    maxResults: String(MAX_EVENTS_PER_SYNC),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Google Calendar events: ${errorText}`);
  }

  const data: GoogleEventList = await response.json();
  const events = data.items || [];

  return events.map(event => ({
    connection_id: connectionId,
    provider_id: event.id,
    title: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    start_at: parseGoogleDateTime(event.start),
    end_at: parseGoogleDateTime(event.end),
    is_all_day: isGoogleAllDayEvent(event),
    status: mapGoogleStatus(event.status),
    organizer: event.organizer?.email ?? null,
    attendees: parseGoogleAttendees(event.attendees),
  }));
}

// =============================================================================
// OUTLOOK CALENDAR SYNC
// =============================================================================

/**
 * Parse Outlook DateTime to ISO 8601 string
 */
function parseOutlookDateTime(dt: { dateTime: string; timeZone: string }): string {
  const normalized = dt.dateTime.replace(/(\.\d{3})\d*/, '$1');
  if (dt.timeZone === 'UTC' || dt.timeZone === 'Etc/UTC') {
    return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  }
  return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
}

/**
 * Map Outlook status to our schema
 */
function mapOutlookStatus(event: OutlookEvent): string | null {
  if (event.isCancelled) return 'cancelled';
  switch (event.showAs) {
    case 'tentative':
      return 'tentative';
    case 'busy':
    case 'oof':
    case 'workingElsewhere':
      return 'confirmed';
    default:
      return 'confirmed';
  }
}

/**
 * Extract location from Outlook event
 */
function extractOutlookLocation(event: OutlookEvent): string | null {
  if (event.location?.displayName) {
    return event.location.displayName;
  }
  if (event.locations && event.locations.length > 0) {
    const names = event.locations.map(l => l.displayName).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  if (event.onlineMeetingUrl) {
    return event.onlineMeetingUrl;
  }
  return null;
}

/**
 * Parse Outlook attendees
 */
function parseOutlookAttendees(attendees?: OutlookEvent['attendees']): object | null {
  if (!attendees || attendees.length === 0) return null;
  return attendees.map(a => ({
    email: a.emailAddress.address,
    name: a.emailAddress.name,
    status: mapOutlookAttendeeStatus(a.status.response),
  }));
}

function mapOutlookAttendeeStatus(response: string): string {
  switch (response) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentativelyAccepted':
      return 'tentative';
    case 'organizer':
      return 'accepted';
    default:
      return 'needsAction';
  }
}

/**
 * Sync events from Outlook Calendar
 */
async function syncOutlookCalendarEvents(
  accessToken: string,
  connectionId: string,
  calendarId: string,
  dateRange: { start: string; end: string }
): Promise<CalendarEventRow[]> {
  const params = new URLSearchParams({
    startDateTime: dateRange.start,
    endDateTime: dateRange.end,
    $top: String(MAX_EVENTS_PER_SYNC),
    $orderby: 'start/dateTime',
    $select:
      'id,subject,bodyPreview,start,end,isAllDay,isCancelled,showAs,organizer,attendees,location,locations,onlineMeetingUrl',
  });

  // Use calendarView for proper handling of recurring events
  let endpoint: string;
  if (calendarId === 'primary') {
    endpoint = `/me/calendar/calendarView?${params.toString()}`;
  } else {
    endpoint = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
  }

  const response = await fetch(`${OUTLOOK_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Outlook Calendar events: ${errorText}`);
  }

  const data: OutlookEventList = await response.json();
  const events = data.value || [];

  return events.map(event => ({
    connection_id: connectionId,
    provider_id: event.id,
    title: event.subject ?? null,
    description: event.bodyPreview ?? null,
    location: extractOutlookLocation(event),
    start_at: parseOutlookDateTime(event.start),
    end_at: parseOutlookDateTime(event.end),
    is_all_day: event.isAllDay,
    status: mapOutlookStatus(event),
    organizer: event.organizer?.emailAddress?.address ?? null,
    attendees: parseOutlookAttendees(event.attendees),
  }));
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      console.error('ENCRYPTION_KEY not configured');
      return errorResponse('Server encryption not configured', 500);
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse request body
    const body = await req.json();
    const { connectionId, dateRange } = body;

    if (!connectionId || typeof connectionId !== 'string') {
      return errorResponse('Missing or invalid connectionId');
    }

    // Fetch calendar connection and verify ownership
    const { data: connection, error: fetchError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      return errorResponse('Calendar connection not found', 404);
    }

    if (connection.user_id !== user.id) {
      return errorResponse('Unauthorized: You do not own this connection', 403);
    }

    if (!connection.is_active) {
      return errorResponse('Calendar connection is not active', 400);
    }

    // Check sync cooldown
    if (connection.last_sync_at) {
      const lastSyncTime = new Date(connection.last_sync_at).getTime();
      const now = Date.now();

      if (now - lastSyncTime < SYNC_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((SYNC_COOLDOWN_MS - (now - lastSyncTime)) / 1000);
        return errorResponse(`Please wait ${remainingSeconds} seconds before syncing again`, 429);
      }
    }

    // Get valid access token (refresh if needed)
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(connection as CalendarConnection, user.id, supabase);
    } catch (tokenError) {
      // Token refresh failed - likely revoked
      await supabase
        .from('calendar_connections')
        .update({
          sync_error: `Token error: ${(tokenError as Error).message}`,
          is_active: false,
        })
        .eq('id', connectionId);

      return errorResponse(`Authentication failed: ${(tokenError as Error).message}`, 401);
    }

    // Determine date range
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + DEFAULT_LOOKAHEAD_DAYS);

    const syncDateRange =
      dateRange && dateRange.start && dateRange.end
        ? { start: dateRange.start, end: dateRange.end }
        : { start: now.toISOString(), end: endDate.toISOString() };

    // Fetch events from provider
    let events: CalendarEventRow[];
    try {
      const calendarId = connection.calendar_id || 'primary';

      if (connection.provider === 'google') {
        events = await syncGoogleCalendarEvents(
          accessToken,
          connectionId,
          calendarId,
          syncDateRange
        );
      } else if (connection.provider === 'outlook') {
        events = await syncOutlookCalendarEvents(
          accessToken,
          connectionId,
          calendarId,
          syncDateRange
        );
      } else {
        return errorResponse(`Unsupported provider: ${connection.provider}`, 400);
      }
    } catch (syncError) {
      // Sync failed
      await supabase
        .from('calendar_connections')
        .update({
          sync_error: (syncError as Error).message,
        })
        .eq('id', connectionId);

      // Check if it's an auth error
      const errorMessage = (syncError as Error).message.toLowerCase();
      if (
        errorMessage.includes('401') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('invalid_grant')
      ) {
        return errorResponse(`Authentication failed: ${(syncError as Error).message}`, 401);
      }

      return errorResponse(`Sync failed: ${(syncError as Error).message}`, 500);
    }

    // Upsert events into database
    if (events.length > 0) {
      const { error: upsertError } = await supabase.from('calendar_events').upsert(events, {
        onConflict: 'connection_id,provider_id',
        ignoreDuplicates: false,
      });

      if (upsertError) {
        console.error('Failed to upsert calendar events:', upsertError);
        return errorResponse(`Failed to save events: ${upsertError.message}`, 500);
      }
    }

    // Update last_sync_at and clear any previous errors
    await supabase
      .from('calendar_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', connectionId);

    return jsonResponse({
      success: true,
      eventCount: events.length,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return errorResponse(`Internal server error: ${(error as Error).message}`, 500);
  }
});
