/**
 * Email Integration Hooks
 *
 * Provides TanStack Query hooks for connecting to email providers (Gmail, Outlook, IMAP),
 * fetching email connections and messages, and syncing emails.
 *
 * Follows the same pattern as useSpotify.ts for OAuth PKCE flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildGmailAuthorizeUrl,
  buildOutlookEmailAuthorizeUrl,
  exchangeGmailCodeForTokens,
  exchangeOutlookCodeForTokens,
  refreshGmailToken,
  refreshOutlookToken,
} from '@/lib/email/oauth';
import { encryptApiKey } from '@/lib/crypto';
import type {
  EmailConnection,
  EmailMessage,
  CreateEmailConnectionIMAPInput,
  EmailProvider,
} from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/** Internal type for email connection with encrypted tokens from DB */
interface EmailConnectionWithTokens extends EmailConnection {
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  expires_at?: string | null;
}

/** OAuth callback result */
interface OAuthCallbackResult {
  connectionId: string;
  emailAddress: string;
}

// ============================================================================
// HELPERS
// ============================================================================

// Listeners for email token death (auto-disconnect)
const tokenDeathListeners = new Map<string, Set<() => void>>();
const deadTokens = new Set<string>();

function notifyTokenDeath(connectionId: string) {
  deadTokens.add(connectionId);
  const listeners = tokenDeathListeners.get(connectionId);
  if (listeners) {
    listeners.forEach(l => l());
  }
}

async function autoDisconnect(connectionId: string) {
  try {
    // Get current user to scope the delete (defense-in-depth, RLS also protects)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn('Email auto-disconnect: no authenticated user');
      return;
    }

    await supabase.from('email_connections').delete().eq('id', connectionId).eq('user_id', user.id); // Ensure user owns the connection
    notifyTokenDeath(connectionId);
  } catch (e) {
    console.warn('Email auto-disconnect failed:', e);
  }
}

/**
 * Get a valid access token for an email connection, refreshing if needed.
 * For OAuth providers (Gmail/Outlook) only.
 */
async function getValidAccessToken(
  connection: EmailConnectionWithTokens,
  decryptedAccessToken: string,
  decryptedRefreshToken: string
): Promise<string> {
  if (!connection.expires_at) {
    return decryptedAccessToken;
  }

  const expiresAt = new Date(connection.expires_at).getTime();
  const now = Date.now();

  // Refresh if token expires within 60 seconds
  if (expiresAt - now < 60_000) {
    try {
      let tokens;
      if (connection.provider === 'gmail') {
        tokens = await refreshGmailToken(decryptedRefreshToken);
      } else if (connection.provider === 'outlook') {
        tokens = await refreshOutlookToken(decryptedRefreshToken);
      } else {
        // IMAP doesn't use OAuth tokens
        return decryptedAccessToken;
      }

      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Encrypt new tokens before storing
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const encryptedAccessToken = await encryptApiKey(tokens.access_token, user.id);
      const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, user.id);

      await supabase
        .from('email_connections')
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
      if (
        msg.includes('revoked') ||
        msg.includes('invalid_grant') ||
        msg.includes('invalid_token')
      ) {
        console.warn('Email token revoked, auto-disconnecting');
        void autoDisconnect(connection.id);
      }
      throw err;
    }
  }

  return decryptedAccessToken;
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

async function fetchEmailConnections(): Promise<EmailConnection[]> {
  const { data, error } = await supabase
    .from('email_connections')
    .select(
      'id, user_id, provider, email_address, is_active, last_sync_at, sync_error, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailConnection[];
}

async function fetchEmailConnection(connectionId: string): Promise<EmailConnection | null> {
  const { data, error } = await supabase
    .from('email_connections')
    .select(
      'id, user_id, provider, email_address, is_active, last_sync_at, sync_error, created_at, updated_at'
    )
    .eq('id', connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as EmailConnection | null;
}

async function fetchEmailMessages(connectionId: string): Promise<EmailMessage[]> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .order('received_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailMessage[];
}

async function fetchRecentEmails(): Promise<EmailMessage[]> {
  // First get user's connections
  const { data: connections, error: connectionsError } = await supabase
    .from('email_connections')
    .select('id')
    .eq('is_active', true);

  if (connectionsError) {
    throw new Error(connectionsError.message);
  }

  if (!connections || connections.length === 0) {
    return [];
  }

  const connectionIds = connections.map(c => c.id);

  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .in('connection_id', connectionIds)
    .order('received_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailMessage[];
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to track token death for a specific email connection.
 * When a token is revoked/invalid, the connection is auto-disconnected.
 */
export function useEmailTokenDeath(connectionId?: string) {
  const queryClient = useQueryClient();
  const [dead, setDead] = useState(connectionId ? deadTokens.has(connectionId) : false);

  useEffect(() => {
    if (!connectionId) return;

    const cb = () => {
      setDead(true);
      // Invalidate queries so UI updates
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnection(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailMessages(connectionId) });
    };

    if (!tokenDeathListeners.has(connectionId)) {
      tokenDeathListeners.set(connectionId, new Set());
    }
    tokenDeathListeners.get(connectionId)!.add(cb);

    return () => {
      tokenDeathListeners.get(connectionId)?.delete(cb);
    };
  }, [connectionId, queryClient]);

  const reset = useCallback(() => {
    if (connectionId) {
      deadTokens.delete(connectionId);
    }
    setDead(false);
  }, [connectionId]);

  return { isDead: dead, reset };
}

/**
 * Query hook for fetching all email connections for the current user.
 */
export function useEmailConnections() {
  const query = useQuery({
    queryKey: queryKeys.emailConnections,
    queryFn: fetchEmailConnections,
  });

  return {
    ...query,
    connections: query.data ?? [],
    hasConnections: (query.data?.length ?? 0) > 0,
  };
}

/**
 * Query hook for fetching a single email connection by ID.
 */
export function useEmailConnection(connectionId: string | undefined) {
  return useQuery({
    queryKey: connectionId ? queryKeys.emailConnection(connectionId) : ['emailConnection', 'none'],
    queryFn: () => (connectionId ? fetchEmailConnection(connectionId) : null),
    enabled: !!connectionId,
  });
}

/**
 * Mutation hook to initiate Gmail OAuth flow.
 * Opens the Gmail authorization page in the browser.
 */
export function useConnectGmail() {
  return useMutation({
    mutationFn: async () => {
      const codeVerifier = generateCodeVerifier();
      sessionStorage.setItem('gmail_code_verifier', codeVerifier);

      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      sessionStorage.setItem('gmail_oauth_state', state);

      let redirectUri: string;
      if (window.desktop?.getOAuthRedirectUrl) {
        redirectUri = await window.desktop.getOAuthRedirectUrl();
      } else {
        redirectUri = window.location.origin + '/email/gmail/callback';
      }
      sessionStorage.setItem('gmail_redirect_uri', redirectUri);

      const authorizeUrl = buildGmailAuthorizeUrl({ codeChallenge, redirectUri, state });

      if (window.desktop?.openExternalUrl) {
        await window.desktop.openExternalUrl(authorizeUrl);
      } else {
        // Navigate in same window so sessionStorage (code verifier) is preserved
        window.location.href = authorizeUrl;
      }
    },
  });
}

/**
 * Mutation hook to initiate Outlook OAuth flow.
 * Opens the Outlook authorization page in the browser.
 */
export function useConnectOutlook() {
  return useMutation({
    mutationFn: async () => {
      const codeVerifier = generateCodeVerifier();
      sessionStorage.setItem('outlook_code_verifier', codeVerifier);

      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      sessionStorage.setItem('outlook_oauth_state', state);

      let redirectUri: string;
      if (window.desktop?.getOAuthRedirectUrl) {
        redirectUri = await window.desktop.getOAuthRedirectUrl();
      } else {
        redirectUri = window.location.origin + '/email/outlook/callback';
      }
      sessionStorage.setItem('outlook_redirect_uri', redirectUri);

      const authorizeUrl = buildOutlookEmailAuthorizeUrl({ codeChallenge, redirectUri, state });

      if (window.desktop?.openExternalUrl) {
        await window.desktop.openExternalUrl(authorizeUrl);
      } else {
        window.location.href = authorizeUrl;
      }
    },
  });
}

/**
 * Function to handle Gmail OAuth callback.
 * Exchanges the authorization code for tokens and stores the connection.
 */
export function useGmailCallback() {
  const queryClient = useQueryClient();

  return async (code: string): Promise<OAuthCallbackResult> => {
    const codeVerifier = sessionStorage.getItem('gmail_code_verifier');
    const redirectUri = sessionStorage.getItem('gmail_redirect_uri');

    if (!codeVerifier || !redirectUri) {
      throw new Error('Missing OAuth state. Please try connecting again.');
    }

    const tokens = await exchangeGmailCodeForTokens({ code, codeVerifier, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Fetch user's email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch Google user info');
    }
    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.email;

    if (!emailAddress) {
      throw new Error('Could not retrieve email address from Google');
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptApiKey(tokens.access_token, user.id);
    const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, user.id);

    // Upsert into email_connections
    const { data, error } = await supabase
      .from('email_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'gmail' as EmailProvider,
          email_address: emailAddress,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: expiresAt,
          is_active: true,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,email_address' }
      )
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Clean up session storage
    sessionStorage.removeItem('gmail_code_verifier');
    sessionStorage.removeItem('gmail_oauth_state');
    sessionStorage.removeItem('gmail_redirect_uri');

    await queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections });

    return { connectionId: data.id, emailAddress };
  };
}

/**
 * Function to handle Outlook OAuth callback.
 * Exchanges the authorization code for tokens and stores the connection.
 */
export function useOutlookCallback() {
  const queryClient = useQueryClient();

  return async (code: string): Promise<OAuthCallbackResult> => {
    const codeVerifier = sessionStorage.getItem('outlook_code_verifier');
    const redirectUri = sessionStorage.getItem('outlook_redirect_uri');

    if (!codeVerifier || !redirectUri) {
      throw new Error('Missing OAuth state. Please try connecting again.');
    }

    const tokens = await exchangeOutlookCodeForTokens({ code, codeVerifier, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Fetch user's email from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch Microsoft user info');
    }
    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.mail || userInfo.userPrincipalName;

    if (!emailAddress) {
      throw new Error('Could not retrieve email address from Microsoft');
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptApiKey(tokens.access_token, user.id);
    const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, user.id);

    // Upsert into email_connections
    const { data, error } = await supabase
      .from('email_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'outlook' as EmailProvider,
          email_address: emailAddress,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: expiresAt,
          is_active: true,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,email_address' }
      )
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Clean up session storage
    sessionStorage.removeItem('outlook_code_verifier');
    sessionStorage.removeItem('outlook_oauth_state');
    sessionStorage.removeItem('outlook_redirect_uri');

    await queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections });

    return { connectionId: data.id, emailAddress };
  };
}

/**
 * Mutation hook to connect an IMAP email account.
 * Encrypts credentials before storing.
 */
export function useConnectIMAP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEmailConnectionIMAPInput) => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Encrypt the IMAP password before storing
      const encryptedPassword = await encryptApiKey(input.imap_password, user.id);

      // Insert into email_connections
      const { data, error } = await supabase
        .from('email_connections')
        .insert({
          user_id: user.id,
          provider: 'imap' as EmailProvider,
          email_address: input.email_address,
          imap_server: input.imap_server,
          imap_port: input.imap_port,
          imap_username: input.imap_username,
          imap_password_encrypted: encryptedPassword,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return { connectionId: data.id, emailAddress: input.email_address };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections });
    },
  });
}

/**
 * Mutation hook to disconnect (delete) an email connection.
 */
export function useDisconnectEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      // Get current user to scope the delete
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('email_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user.id); // Ensure user owns the connection

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: (_data, connectionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnection(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailMessages(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentEmails });
    },
  });
}

/**
 * Query hook for fetching email messages for a specific connection.
 */
export function useEmailMessages(connectionId: string | undefined) {
  return useQuery({
    queryKey: connectionId ? queryKeys.emailMessages(connectionId) : ['emailMessages', 'none'],
    queryFn: () => (connectionId ? fetchEmailMessages(connectionId) : []),
    enabled: !!connectionId,
  });
}

/**
 * Query hook for fetching recent emails across all active connections.
 */
export function useRecentEmails() {
  return useQuery({
    queryKey: queryKeys.recentEmails,
    queryFn: fetchRecentEmails,
  });
}

/**
 * Mutation hook to trigger email sync for a connection.
 * This would typically call an Edge Function that fetches new emails.
 */
export function useSyncEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      // Get current session for auth header
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/email-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ connectionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Sync failed with status ${response.status}`);
      }

      const result = await response.json();
      return result;
    },
    onSuccess: (_data, connectionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailMessages(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnection(connectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentEmails });
    },
    onError: async (error, connectionId) => {
      // Update connection with sync error
      await supabase
        .from('email_connections')
        .update({
          sync_error: String(error),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnection(connectionId) });
    },
  });
}

/**
 * Mutation hook to toggle the active status of an email connection.
 */
export function useToggleEmailConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, isActive }: { connectionId: string; isActive: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('email_connections')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailConnections });
      queryClient.invalidateQueries({
        queryKey: queryKeys.emailConnection(variables.connectionId),
      });
    },
  });
}

// Export helper for use by edge functions or other parts of the app
export { getValidAccessToken };
