/**
 * Calendar Integration Hooks
 *
 * Provides TanStack Query hooks for connecting to Google Calendar and
 * Outlook Calendar, fetching events, and managing calendar connections.
 *
 * Follows the OAuth 2.0 PKCE flow for secure authentication without client secrets.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildGoogleCalendarAuthorizeUrl,
  buildOutlookCalendarAuthorizeUrl,
  exchangeGoogleCalendarCodeForTokens,
  exchangeOutlookCalendarCodeForTokens,
  refreshGoogleCalendarToken,
  refreshOutlookCalendarToken,
  googleCalendarApiFetch,
  outlookCalendarApiFetch,
} from '@/lib/calendar/oauth';
import { CALENDAR_SYNC_CONFIG } from '@/lib/calendar/constants';
import { encryptApiKey, decryptApiKey } from '@/lib/crypto';
import type {
  CalendarConnection,
  CalendarEvent,
  CalendarEventsList,
  CalendarDateRange,
  CalendarSyncResult,
  TodayEventsSummary,
  CalendarProvider,
} from '@/schemas/calendar';

// ============================================================================
// TYPES
// ============================================================================

/** Internal connection type with encrypted token fields for token management */
interface CalendarConnectionWithTokens extends CalendarConnection {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
}

// ============================================================================
// TOKEN DEATH HANDLING (Auto-disconnect on revoked tokens)
// ============================================================================

const tokenDeathListeners = new Set<(connectionId: string) => void>();
const deadConnections = new Set<string>();

function notifyTokenDeath(connectionId: string) {
  deadConnections.add(connectionId);
  tokenDeathListeners.forEach(l => l(connectionId));
}

async function autoDisconnect(connectionId: string) {
  try {
    await supabase.from('calendar_connections').delete().eq('id', connectionId);
    notifyTokenDeath(connectionId);
  } catch (e) {
    console.warn('Calendar auto-disconnect failed:', e);
  }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Get a valid access token for a calendar connection, refreshing if needed
 */
async function getValidAccessToken(connection: CalendarConnectionWithTokens): Promise<string> {
  // Get current user for decryption
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Decrypt tokens
  const accessToken = await decryptApiKey(connection.access_token_encrypted, user.id);
  const refreshToken = await decryptApiKey(connection.refresh_token_encrypted, user.id);

  const expiresAt = new Date(connection.expires_at).getTime();
  const now = Date.now();

  // Refresh if token expires within 60 seconds
  if (expiresAt - now < 60_000) {
    try {
      const tokens =
        connection.provider === 'google'
          ? await refreshGoogleCalendarToken(refreshToken)
          : await refreshOutlookCalendarToken(refreshToken);

      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Encrypt new tokens before storing
      const encryptedAccessToken = await encryptApiKey(tokens.access_token, user.id);

      // Google sometimes doesn't return a new refresh_token on refresh.
      // Only update refresh_token_encrypted if a new one was returned,
      // otherwise keep the existing one to avoid invalidating future refreshes.
      const newRefreshToken = tokens.refresh_token || refreshToken;
      const encryptedRefreshToken = tokens.refresh_token
        ? await encryptApiKey(tokens.refresh_token, user.id)
        : connection.refresh_token_encrypted; // Keep existing encrypted token

      await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      return tokens.access_token;
    } catch (err) {
      const msg = String(err);
      // If refresh token is revoked/invalid, auto-disconnect
      if (msg.includes('revoked') || msg.includes('invalid_grant')) {
        console.warn('Calendar token revoked, auto-disconnecting');
        void autoDisconnect(connection.id);
      }
      throw err;
    }
  }

  return accessToken;
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

async function fetchCalendarConnections(): Promise<CalendarConnection[]> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select(
      'id, user_id, provider, calendar_id, email_address, is_active, last_sync_at, sync_error, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalendarConnection[];
}

async function fetchCalendarConnection(connectionId: string): Promise<CalendarConnection | null> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select(
      'id, user_id, provider, calendar_id, email_address, is_active, last_sync_at, sync_error, created_at, updated_at'
    )
    .eq('id', connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarConnection | null;
}

async function fetchCalendarConnectionWithTokens(
  connectionId: string
): Promise<CalendarConnectionWithTokens | null> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarConnectionWithTokens | null;
}

async function fetchCalendarEvents(
  connectionId: string,
  dateRange?: CalendarDateRange
): Promise<CalendarEventsList> {
  let query = supabase
    .from('calendar_events')
    .select('*')
    .eq('connection_id', connectionId)
    .order('start_at', { ascending: true });

  if (dateRange) {
    query = query.gte('start_at', dateRange.start).lte('end_at', dateRange.end);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    events: (data ?? []) as CalendarEvent[],
    has_more: false, // Local cache doesn't paginate
  };
}

async function fetchTodayEvents(): Promise<TodayEventsSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_at', todayStart.toISOString())
    .lte('start_at', todayEnd.toISOString())
    .order('start_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const events = (data ?? []) as CalendarEvent[];
  const now = new Date();

  // Find current or next event
  const currentOrNext =
    events.find(event => {
      const startAt = new Date(event.start_at);
      const endAt = new Date(event.end_at);
      // Currently happening or starts in the future
      return (startAt <= now && endAt > now) || startAt > now;
    }) ?? null;

  return {
    total_events: events.length,
    current_or_next: currentOrNext,
    events,
    ai_summary: null, // AI summary is generated separately
  };
}

async function fetchUpcomingEvents(days: number): Promise<CalendarEvent[]> {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_at', now.toISOString())
    .lte('start_at', endDate.toISOString())
    .order('start_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalendarEvent[];
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

async function syncGoogleCalendarEvents(
  connection: CalendarConnectionWithTokens
): Promise<CalendarSyncResult> {
  const accessToken = await getValidAccessToken(connection);

  // Calculate date range (14 days lookahead by default)
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  const maxPages = 10; // Safety limit to prevent infinite loops
  let pageCount = 0;

  // Fetch all pages of events
  do {
    pageCount++;
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(CALENDAR_SYNC_CONFIG.MAX_EVENTS_PER_SYNC),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await googleCalendarApiFetch(
      accessToken,
      `/calendars/${connection.calendar_id || 'primary'}/events?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar sync failed: ${errorText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      // Skip cancelled events
      if (item.status === 'cancelled') continue;

      // Parse start/end times (handle all-day events)
      const isAllDay = !!item.start?.date;
      const startAt = isAllDay ? `${item.start.date}T00:00:00Z` : item.start?.dateTime;
      const endAt = isAllDay ? `${item.end.date}T23:59:59Z` : item.end?.dateTime;

      if (!startAt || !endAt) continue;

      events.push({
        id: crypto.randomUUID(),
        connection_id: connection.id,
        provider_id: item.id,
        title: item.summary || null,
        description: item.description || null,
        location: item.location || null,
        start_at: startAt,
        end_at: endAt,
        is_all_day: isAllDay,
        status:
          item.status === 'confirmed'
            ? 'confirmed'
            : item.status === 'tentative'
              ? 'tentative'
              : null,
        organizer: item.organizer?.email || null,
        attendees:
          item.attendees?.map(
            (a: { email: string; displayName?: string; responseStatus?: string }) => ({
              email: a.email,
              name: a.displayName,
              status: a.responseStatus || 'needsAction',
            })
          ) || null,
        ai_summary: null,
      });
    }

    // Get next page token for pagination
    pageToken = data.nextPageToken;
  } while (pageToken && pageCount < maxPages);

  // Upsert events using provider_id as conflict key (safer than delete-then-insert)
  // This prevents data loss if the upsert partially fails
  if (events.length > 0) {
    // Prepare events for upsert - remove 'id' field to let DB generate it on insert
    const eventsForUpsert = events.map(({ id: _id, ...rest }) => rest);
    const { error: upsertError } = await supabase
      .from('calendar_events')
      .upsert(eventsForUpsert, { onConflict: 'connection_id,provider_id' });
    if (upsertError) {
      throw new Error(`Failed to store events: ${upsertError.message}`);
    }
  }

  // Clean up events that are no longer in the calendar (deleted or outside date range)
  const providerIds = events.map(e => e.provider_id);
  if (providerIds.length > 0) {
    // Delete events for this connection that weren't in the sync response
    await supabase
      .from('calendar_events')
      .delete()
      .eq('connection_id', connection.id)
      .not('provider_id', 'in', `(${providerIds.join(',')})`);
  }

  // Update last_sync_at
  await supabase
    .from('calendar_connections')
    .update({ last_sync_at: new Date().toISOString(), sync_error: null })
    .eq('id', connection.id);

  return {
    success: true,
    event_count: events.length,
    synced_at: new Date().toISOString(),
  };
}

async function syncOutlookCalendarEvents(
  connection: CalendarConnectionWithTokens
): Promise<CalendarSyncResult> {
  const accessToken = await getValidAccessToken(connection);

  // Calculate date range (14 days lookahead)
  const startDateTime = new Date().toISOString();
  const endDateTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const events: CalendarEvent[] = [];
  let nextLink: string | undefined;
  const maxPages = 10; // Safety limit to prevent infinite loops
  let pageCount = 0;

  // Build initial URL
  const initialParams = new URLSearchParams({
    startDateTime,
    endDateTime,
    $top: String(CALENDAR_SYNC_CONFIG.MAX_EVENTS_PER_SYNC),
    $orderby: 'start/dateTime',
    $select:
      'id,subject,bodyPreview,location,start,end,isAllDay,showAs,organizer,attendees,isCancelled',
  });
  let currentUrl: string | null = `/me/calendarView?${initialParams.toString()}`;

  // Fetch all pages of events
  do {
    pageCount++;

    const response = nextLink
      ? await fetch(nextLink, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      : await outlookCalendarApiFetch(accessToken, currentUrl!);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outlook Calendar sync failed: ${errorText}`);
    }

    const data = await response.json();

    for (const item of data.value || []) {
      // Skip cancelled events
      if (item.isCancelled) continue;

      const startAt = item.start?.dateTime
        ? new Date(item.start.dateTime + 'Z').toISOString()
        : null;
      const endAt = item.end?.dateTime ? new Date(item.end.dateTime + 'Z').toISOString() : null;

      if (!startAt || !endAt) continue;

      // Map Outlook showAs to our status
      let status: 'confirmed' | 'tentative' | null = null;
      if (item.showAs === 'busy' || item.showAs === 'oof') status = 'confirmed';
      else if (item.showAs === 'tentative') status = 'tentative';

      events.push({
        id: crypto.randomUUID(),
        connection_id: connection.id,
        provider_id: item.id,
        title: item.subject || null,
        description: item.bodyPreview || null,
        location: item.location?.displayName || null,
        start_at: startAt,
        end_at: endAt,
        is_all_day: item.isAllDay ?? false,
        status,
        organizer: item.organizer?.emailAddress?.address || null,
        attendees:
          item.attendees?.map(
            (a: {
              emailAddress?: { address?: string; name?: string };
              status?: { response?: string };
            }) => ({
              email: a.emailAddress?.address || '',
              name: a.emailAddress?.name,
              status: a.status?.response || 'none',
            })
          ) || null,
        ai_summary: null,
      });
    }

    // Get next page link for pagination (Microsoft Graph uses @odata.nextLink)
    nextLink = data['@odata.nextLink'];
    currentUrl = null; // Only use nextLink for subsequent pages
  } while (nextLink && pageCount < maxPages);

  // Upsert events using provider_id as conflict key (safer than delete-then-insert)
  // This prevents data loss if the upsert partially fails
  if (events.length > 0) {
    // Prepare events for upsert - remove 'id' field to let DB generate it on insert
    const eventsForUpsert = events.map(({ id: _id, ...rest }) => rest);
    const { error: upsertError } = await supabase
      .from('calendar_events')
      .upsert(eventsForUpsert, { onConflict: 'connection_id,provider_id' });
    if (upsertError) {
      throw new Error(`Failed to store events: ${upsertError.message}`);
    }
  }

  // Clean up events that are no longer in the calendar (deleted or outside date range)
  const providerIds = events.map(e => e.provider_id);
  if (providerIds.length > 0) {
    // Delete events for this connection that weren't in the sync response
    await supabase
      .from('calendar_events')
      .delete()
      .eq('connection_id', connection.id)
      .not('provider_id', 'in', `(${providerIds.join(',')})`);
  }

  // Update last_sync_at
  await supabase
    .from('calendar_connections')
    .update({ last_sync_at: new Date().toISOString(), sync_error: null })
    .eq('id', connection.id);

  return {
    success: true,
    event_count: events.length,
    synced_at: new Date().toISOString(),
  };
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to listen for calendar token death (revoked tokens)
 */
export function useCalendarTokenDeath() {
  const queryClient = useQueryClient();
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set(deadConnections));

  useEffect(() => {
    const cb = (connectionId: string) => {
      setDeadIds(prev => new Set([...prev, connectionId]));
      // Invalidate queries so UI updates
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnections });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnection(connectionId) });
    };
    tokenDeathListeners.add(cb);
    return () => {
      tokenDeathListeners.delete(cb);
    };
  }, [queryClient]);

  const reset = useCallback((connectionId?: string) => {
    if (connectionId) {
      deadConnections.delete(connectionId);
      setDeadIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    } else {
      deadConnections.clear();
      setDeadIds(new Set());
    }
  }, []);

  return { deadIds, isDead: (id: string) => deadIds.has(id), reset };
}

/**
 * Fetch all calendar connections for the current user
 */
export function useCalendarConnections() {
  const query = useQuery({
    queryKey: queryKeys.calendarConnections,
    queryFn: fetchCalendarConnections,
  });

  return {
    ...query,
    connections: query.data ?? [],
    hasConnections: (query.data?.length ?? 0) > 0,
  };
}

/**
 * Fetch a single calendar connection by ID
 */
export function useCalendarConnection(connectionId: string | undefined) {
  return useQuery({
    queryKey: connectionId
      ? queryKeys.calendarConnection(connectionId)
      : ['calendarConnection', 'none'],
    queryFn: () => (connectionId ? fetchCalendarConnection(connectionId) : null),
    enabled: !!connectionId,
  });
}

/**
 * Start Google Calendar OAuth flow
 */
export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async () => {
      const codeVerifier = generateCodeVerifier();
      sessionStorage.setItem('calendar_code_verifier', codeVerifier);
      sessionStorage.setItem('calendar_provider', 'google');

      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      sessionStorage.setItem('calendar_oauth_state', state);

      let redirectUri: string;
      if (window.desktop?.getOAuthRedirectUrl) {
        redirectUri = await window.desktop.getOAuthRedirectUrl();
      } else {
        redirectUri = window.location.origin + '/calendar/callback';
      }
      sessionStorage.setItem('calendar_redirect_uri', redirectUri);

      const authorizeUrl = buildGoogleCalendarAuthorizeUrl({ codeChallenge, redirectUri, state });

      if (window.desktop?.openExternalUrl) {
        await window.desktop.openExternalUrl(authorizeUrl);
      } else {
        window.location.href = authorizeUrl;
      }
    },
  });
}

/**
 * Start Outlook Calendar OAuth flow
 */
export function useConnectOutlookCalendar() {
  return useMutation({
    mutationFn: async () => {
      const codeVerifier = generateCodeVerifier();
      sessionStorage.setItem('calendar_code_verifier', codeVerifier);
      sessionStorage.setItem('calendar_provider', 'outlook');

      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      sessionStorage.setItem('calendar_oauth_state', state);

      let redirectUri: string;
      if (window.desktop?.getOAuthRedirectUrl) {
        redirectUri = await window.desktop.getOAuthRedirectUrl();
      } else {
        redirectUri = window.location.origin + '/calendar/callback';
      }
      sessionStorage.setItem('calendar_redirect_uri', redirectUri);

      const authorizeUrl = buildOutlookCalendarAuthorizeUrl({ codeChallenge, redirectUri, state });

      if (window.desktop?.openExternalUrl) {
        await window.desktop.openExternalUrl(authorizeUrl);
      } else {
        window.location.href = authorizeUrl;
      }
    },
  });
}

/**
 * Handle Google Calendar OAuth callback
 */
export function useGoogleCalendarCallback() {
  const queryClient = useQueryClient();

  return async (code: string) => {
    const codeVerifier = sessionStorage.getItem('calendar_code_verifier');
    const redirectUri = sessionStorage.getItem('calendar_redirect_uri');

    if (!codeVerifier || !redirectUri) {
      throw new Error('Missing OAuth state. Please try connecting again.');
    }

    const tokens = await exchangeGoogleCalendarCodeForTokens({ code, codeVerifier, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get user's email from Google
    const userInfoResponse = await googleCalendarApiFetch(
      tokens.access_token,
      '/../oauth2/v3/userinfo' // Goes to googleapis.com/oauth2/v3/userinfo
    );

    let emailAddress = 'unknown@calendar';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      emailAddress = userInfo.email || emailAddress;
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptApiKey(tokens.access_token, user.id);
    const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, user.id);

    // Upsert into calendar_connections (allows reconnecting existing calendars)
    const { error } = await supabase.from('calendar_connections').upsert(
      {
        user_id: user.id,
        provider: 'google' as CalendarProvider,
        email_address: emailAddress,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: expiresAt,
        is_active: true,
        sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,email_address' }
    );

    if (error) {
      throw new Error(error.message);
    }

    // Clean up session storage
    sessionStorage.removeItem('calendar_code_verifier');
    sessionStorage.removeItem('calendar_oauth_state');
    sessionStorage.removeItem('calendar_redirect_uri');
    sessionStorage.removeItem('calendar_provider');

    await queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnections });
  };
}

/**
 * Handle Outlook Calendar OAuth callback
 */
export function useOutlookCalendarCallback() {
  const queryClient = useQueryClient();

  return async (code: string) => {
    const codeVerifier = sessionStorage.getItem('calendar_code_verifier');
    const redirectUri = sessionStorage.getItem('calendar_redirect_uri');

    if (!codeVerifier || !redirectUri) {
      throw new Error('Missing OAuth state. Please try connecting again.');
    }

    const tokens = await exchangeOutlookCalendarCodeForTokens({ code, codeVerifier, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get user's email from Microsoft Graph
    const userResponse = await outlookCalendarApiFetch(tokens.access_token, '/me');

    let emailAddress = 'unknown@calendar';
    if (userResponse.ok) {
      const userData = await userResponse.json();
      emailAddress = userData.mail || userData.userPrincipalName || emailAddress;
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptApiKey(tokens.access_token, user.id);
    const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, user.id);

    // Upsert into calendar_connections (allows reconnecting existing calendars)
    const { error } = await supabase.from('calendar_connections').upsert(
      {
        user_id: user.id,
        provider: 'outlook' as CalendarProvider,
        email_address: emailAddress,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: expiresAt,
        is_active: true,
        sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,email_address' }
    );

    if (error) {
      throw new Error(error.message);
    }

    // Clean up session storage
    sessionStorage.removeItem('calendar_code_verifier');
    sessionStorage.removeItem('calendar_oauth_state');
    sessionStorage.removeItem('calendar_redirect_uri');
    sessionStorage.removeItem('calendar_provider');

    await queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnections });
  };
}

/**
 * Disconnect a calendar connection
 */
export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      // Delete events first (foreign key constraint)
      await supabase.from('calendar_events').delete().eq('connection_id', connectionId);

      // Delete the connection
      const { error } = await supabase.from('calendar_connections').delete().eq('id', connectionId);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSettled: (_data, _error, connectionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnections });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnection(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayEvents });
    },
  });
}

/**
 * Fetch calendar events for a connection with optional date range
 */
export function useCalendarEvents(connectionId: string | undefined, dateRange?: CalendarDateRange) {
  return useQuery({
    queryKey: connectionId
      ? queryKeys.calendarEvents(
          connectionId,
          dateRange ? { start: dateRange.start, end: dateRange.end } : undefined
        )
      : ['calendarEvents', 'none'],
    queryFn: () =>
      connectionId ? fetchCalendarEvents(connectionId, dateRange) : { events: [], has_more: false },
    enabled: !!connectionId,
  });
}

/**
 * Sync calendar events from provider
 * Enforces a 5-minute cooldown between syncs to prevent API rate limiting.
 */
export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const connection = await fetchCalendarConnectionWithTokens(connectionId);
      if (!connection) {
        throw new Error('Calendar connection not found');
      }

      // Enforce sync cooldown (5 minutes between syncs)
      if (connection.last_sync_at) {
        const lastSyncTime = new Date(connection.last_sync_at).getTime();
        const now = Date.now();
        const elapsedMs = now - lastSyncTime;
        const remainingMs = CALENDAR_SYNC_CONFIG.SYNC_COOLDOWN_MS - elapsedMs;

        if (remainingMs > 0) {
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          throw new Error(`Please wait ${remainingSeconds} seconds before syncing again.`);
        }
      }

      if (connection.provider === 'google') {
        return syncGoogleCalendarEvents(connection);
      } else {
        return syncOutlookCalendarEvents(connection);
      }
    },
    onSuccess: (_data, connectionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnection(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayEvents });
    },
    onError: async (error, connectionId) => {
      // Update sync_error in the connection
      await supabase
        .from('calendar_connections')
        .update({ sync_error: String(error) })
        .eq('id', connectionId);

      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConnection(connectionId) });
    },
  });
}

/**
 * Fetch today's events across all calendars
 */
export function useTodayEvents() {
  return useQuery({
    queryKey: queryKeys.todayEvents,
    queryFn: fetchTodayEvents,
    // Refetch every 5 minutes to keep current event up to date
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Fetch upcoming events for the next N days across all calendars
 */
export function useUpcomingEvents(days: number = 7) {
  return useQuery({
    queryKey: queryKeys.upcomingEvents(days),
    queryFn: () => fetchUpcomingEvents(days),
  });
}
