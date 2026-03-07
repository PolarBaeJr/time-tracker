/**
 * Spotify Integration Hooks
 *
 * Provides TanStack Query hooks for connecting to Spotify,
 * fetching playback state, and controlling playback.
 */

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  spotifyFetch,
} from '@/lib/spotify';
import {
  initPlayer,
  destroyPlayer,
  getPlayer,
  getDeviceId,
  getIsPremium,
  subscribePlayerState,
  getPlayerStateSnapshot,
  subscribePlayerError,
  getPlayerErrorSnapshot,
} from '@/lib/spotifyPlayer';

// ============================================================================
// TYPES
// ============================================================================

export interface SpotifyConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  spotify_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
  progressMs: number;
}

export interface SpotifyPlaybackState {
  track: SpotifyTrack | null;
  isPlaying: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

async function getValidAccessToken(connection: SpotifyConnection): Promise<string> {
  const expiresAt = new Date(connection.expires_at).getTime();
  const now = Date.now();

  // Refresh if token expires within 60 seconds
  if (expiresAt - now < 60_000) {
    try {
      const tokens = await refreshAccessToken(connection.refresh_token);
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabase
        .from('spotify_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      return tokens.access_token;
    } catch (err) {
      console.warn('Failed to refresh Spotify token:', err);
      throw err;
    }
  }

  return connection.access_token;
}

// ============================================================================
// FETCH
// ============================================================================

async function fetchSpotifyConnection(): Promise<SpotifyConnection | null> {
  const { data, error } = await supabase.from('spotify_connections').select('*').maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SpotifyConnection | null;
}

async function fetchPlaybackState(connection: SpotifyConnection): Promise<SpotifyPlaybackState> {
  const accessToken = await getValidAccessToken(connection);
  const response = await spotifyFetch(accessToken, '/me/player');

  // 204 = no active device
  if (response.status === 204 || response.status === 202) {
    return { track: null, isPlaying: false };
  }

  if (!response.ok) {
    console.warn('Spotify playback fetch failed:', response.status);
    return { track: null, isPlaying: false };
  }

  const data = await response.json();

  if (!data?.item) {
    return { track: null, isPlaying: false };
  }

  return {
    track: {
      name: data.item.name,
      artist: data.item.artists?.map((a: { name: string }) => a.name).join(', ') ?? 'Unknown',
      albumArt: data.item.album?.images?.[0]?.url ?? null,
      durationMs: data.item.duration_ms ?? 0,
      progressMs: data.progress_ms ?? 0,
    },
    isPlaying: data.is_playing ?? false,
  };
}

// ============================================================================
// HOOKS
// ============================================================================

export function useSpotifyConnection() {
  const query = useQuery({
    queryKey: queryKeys.spotifyConnection,
    queryFn: fetchSpotifyConnection,
  });

  return {
    ...query,
    isConnected: !!query.data,
  };
}

export function useConnectSpotify() {
  return useMutation({
    mutationFn: async () => {
      const codeVerifier = generateCodeVerifier();
      sessionStorage.setItem('spotify_code_verifier', codeVerifier);

      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      sessionStorage.setItem('spotify_oauth_state', state);

      let redirectUri: string;
      if (window.desktop?.getOAuthRedirectUrl) {
        redirectUri = await window.desktop.getOAuthRedirectUrl();
      } else {
        redirectUri = window.location.origin + '/spotify/callback';
      }
      sessionStorage.setItem('spotify_redirect_uri', redirectUri);

      const authorizeUrl = buildAuthorizeUrl({ codeChallenge, redirectUri, state });

      if (window.desktop?.openExternalUrl) {
        await window.desktop.openExternalUrl(authorizeUrl);
      } else {
        window.open(authorizeUrl, '_blank');
      }
    },
  });
}

export function useSpotifyCallback() {
  const queryClient = useQueryClient();

  return async (code: string) => {
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
    const redirectUri = sessionStorage.getItem('spotify_redirect_uri');

    if (!codeVerifier || !redirectUri) {
      throw new Error('Missing OAuth state. Please try connecting again.');
    }

    const tokens = await exchangeCodeForTokens({ code, codeVerifier, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Upsert into spotify_connections
    const { error } = await supabase.from('spotify_connections').upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw new Error(error.message);
    }

    // Clean up session storage
    sessionStorage.removeItem('spotify_code_verifier');
    sessionStorage.removeItem('spotify_oauth_state');
    sessionStorage.removeItem('spotify_redirect_uri');

    await queryClient.invalidateQueries({ queryKey: queryKeys.spotifyConnection });
  };
}

export function useDisconnectSpotify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('spotify_connections').delete().neq('id', '');

      if (error) {
        throw new Error(error.message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spotifyConnection });
      queryClient.invalidateQueries({ queryKey: queryKeys.spotifyPlayback });
    },
  });
}

export function useSpotifyPlayback(enabled: boolean) {
  const { data: connection } = useSpotifyConnection();

  return useQuery({
    queryKey: queryKeys.spotifyPlayback,
    queryFn: () => fetchPlaybackState(connection!),
    enabled: enabled && !!connection,
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function useSpotifyControls() {
  const { data: connection } = useSpotifyConnection();

  const callApi = async (path: string, method: string = 'PUT') => {
    if (!connection) {
      console.warn('No Spotify connection');
      return;
    }

    try {
      const accessToken = await getValidAccessToken(connection);
      const response = await spotifyFetch(accessToken, path, { method });

      if (!response.ok && response.status !== 204) {
        console.warn(`Spotify API error (${path}):`, response.status);
      }
    } catch (err) {
      console.warn(`Spotify control failed (${path}):`, err);
    }
  };

  return {
    togglePlay: async () => {
      const p = getPlayer();
      if (p) {
        await p.togglePlay();
      } else {
        // Determine current state to decide play vs pause
        await callApi('/me/player/play');
      }
    },
    play: () => callApi('/me/player/play'),
    pause: () => callApi('/me/player/pause'),
    next: async () => {
      const p = getPlayer();
      if (p) {
        await p.nextTrack();
      } else {
        await callApi('/me/player/next', 'POST');
      }
    },
    previous: async () => {
      const p = getPlayer();
      if (p) {
        await p.previousTrack();
      } else {
        await callApi('/me/player/previous', 'POST');
      }
    },
    seek: async (ms: number) => {
      const p = getPlayer();
      if (p) {
        await p.seek(ms);
      }
    },
    setVolume: async (v: number) => {
      const p = getPlayer();
      if (p) {
        await p.setVolume(v);
      }
    },
  };
}

export function useSpotifyPlayer(connection: SpotifyConnection | null | undefined) {
  const [isReady, setIsReady] = useState(false);
  const error = useSyncExternalStore(subscribePlayerError, getPlayerErrorSnapshot, () => null);

  useEffect(() => {
    if (!connection) return;

    let cancelled = false;

    const getAccessToken = async () => {
      return getValidAccessToken(connection);
    };

    initPlayer(getAccessToken)
      .then(() => {
        if (!cancelled) setIsReady(!!getDeviceId());
        // Poll briefly for device_id since 'ready' fires async
        const check = setInterval(() => {
          if (cancelled) {
            clearInterval(check);
            return;
          }
          if (getDeviceId()) {
            setIsReady(true);
            clearInterval(check);
          }
        }, 200);
        setTimeout(() => clearInterval(check), 5000);
      })
      .catch(err => {
        console.warn('Spotify SDK init failed:', err);
      });

    return () => {
      cancelled = true;
      destroyPlayer();
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-init when connection row changes
  }, [connection?.id]);

  return {
    isReady,
    error,
    isPremium: getIsPremium(),
  };
}

export function useSpotifySDKPlayback(): SpotifyPlaybackState | null {
  const state = useSyncExternalStore(subscribePlayerState, getPlayerStateSnapshot, () => null);

  if (!state) return null;

  return {
    track: state.track
      ? {
          name: state.track.name,
          artist: state.track.artist,
          albumArt: state.track.albumArt,
          durationMs: state.track.durationMs,
          progressMs: state.progressMs,
        }
      : null,
    isPlaying: state.isPlaying,
  };
}

export function useSpotifyProgress(sdkState: SpotifyPlaybackState | null) {
  const currentProgressMs = sdkState?.track?.progressMs ?? 0;
  const isPlaying = sdkState?.isPlaying ?? false;
  const durationMs = sdkState?.track?.durationMs ?? 0;

  const [interpolated, setInterpolated] = useState(0);
  const baseRef = useRef({ progressMs: 0, timestamp: 0 });

  // Interpolation timer: runs when playing, syncs base on SDK state changes
  useEffect(() => {
    // Always update base from latest SDK state
    baseRef.current = { progressMs: currentProgressMs, timestamp: Date.now() };

    if (!isPlaying || !durationMs) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - baseRef.current.timestamp;
      setInterpolated(Math.min(baseRef.current.progressMs + elapsed, durationMs));
    }, 200);

    return () => clearInterval(interval);
  }, [currentProgressMs, isPlaying, durationMs]);

  return {
    progressMs: sdkState?.track ? (isPlaying ? interpolated : currentProgressMs) : 0,
    durationMs,
  };
}
