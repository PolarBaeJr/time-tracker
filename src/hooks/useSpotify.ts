/**
 * Spotify Integration Hooks
 *
 * Provides TanStack Query hooks for connecting to Spotify,
 * fetching playback state, and controlling playback.
 */

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
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
  loadSpotifyPlaybackSDK,
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

// Listeners for Spotify token death (auto-disconnect)
const tokenDeathListeners = new Set<() => void>();
let tokenDead = false;

function notifyTokenDeath() {
  tokenDead = true;
  tokenDeathListeners.forEach(l => l());
}

async function autoDisconnect() {
  try {
    destroyPlayer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('spotify_connections').delete().eq('user_id', user.id);
    }
    notifyTokenDeath();
  } catch (e) {
    console.warn('Auto-disconnect failed:', e);
  }
}

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
      const msg = String(err);
      // If refresh token is revoked/invalid, auto-disconnect
      if (msg.includes('revoked') || msg.includes('invalid_grant')) {
        console.warn('Spotify token revoked, auto-disconnecting');
        void autoDisconnect();
      }
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

export function useSpotifyTokenDeath() {
  const queryClient = useQueryClient();
  const [dead, setDead] = useState(tokenDead);

  useEffect(() => {
    const cb = () => {
      setDead(true);
      // Invalidate queries so UI updates
      queryClient.invalidateQueries({ queryKey: queryKeys.spotifyConnection });
      queryClient.invalidateQueries({ queryKey: queryKeys.spotifyPlayback });
    };
    tokenDeathListeners.add(cb);
    return () => { tokenDeathListeners.delete(cb); };
  }, [queryClient]);

  const reset = useCallback(() => {
    tokenDead = false;
    setDead(false);
  }, []);

  return { isDead: dead, reset };
}

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
        // Navigate in same window so sessionStorage (code verifier) is preserved
        window.location.href = authorizeUrl;
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
      // Get current user to scope the delete
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('spotify_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      destroyPlayer();
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
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useSpotifyControls() {
  const { data: connection } = useSpotifyConnection();
  const queryClient = useQueryClient();
  const transferringRef = useRef(false);

  const useSdk = () => (getDeviceId() ? getPlayer() : null);

  const refetchPlayback = () => {
    // Short delay so Spotify's state has time to update
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spotifyPlayback });
    }, 300);
  };

  const callApi = async (path: string, method: string = 'PUT', body?: string) => {
    if (!connection) {
      console.warn('No Spotify connection');
      return null;
    }

    try {
      const accessToken = await getValidAccessToken(connection);
      const opts: RequestInit = { method };
      if (body) opts.body = body;
      const response = await spotifyFetch(accessToken, path, opts);

      if (!response.ok && response.status !== 204) {
        console.warn(`Spotify API error (${path}):`, response.status);
      }
      return response;
    } catch (err) {
      console.warn(`Spotify control failed (${path}):`, err);
      return null;
    }
  };

  return {
    togglePlay: async (isCurrentlyPlaying?: boolean) => {
      const sdk = useSdk();
      if (sdk) {
        const state = await sdk.getCurrentState();
        if (state) {
          await sdk.togglePlay();
          return;
        }
        // No state — transfer playback to this device
        if (!transferringRef.current) {
          transferringRef.current = true;
          setTimeout(() => { transferringRef.current = false; }, 3000);
          const deviceId = getDeviceId();
          if (deviceId) {
            await callApi('/me/player', 'PUT', JSON.stringify({
              device_ids: [deviceId],
              play: true,
            }));
            return;
          }
        }
      }
      // Fall through to REST
      if (isCurrentlyPlaying) {
        await callApi('/me/player/pause');
      } else {
        await callApi('/me/player/play');
      }
      refetchPlayback();
    },
    play: async () => { await callApi('/me/player/play'); refetchPlayback(); },
    pause: async () => { await callApi('/me/player/pause'); refetchPlayback(); },
    next: async () => {
      const sdk = useSdk();
      if (sdk) { await sdk.nextTrack(); return; }
      await callApi('/me/player/next', 'POST');
      refetchPlayback();
    },
    previous: async () => {
      const sdk = useSdk();
      if (sdk) { await sdk.previousTrack(); return; }
      await callApi('/me/player/previous', 'POST');
      refetchPlayback();
    },
    seek: async (ms: number) => {
      const sdk = useSdk();
      if (sdk) { await sdk.seek(ms); return; }
      await callApi(`/me/player/seek?position_ms=${ms}`, 'PUT');
    },
    setVolume: async (v: number) => {
      const sdk = useSdk();
      if (sdk) { await sdk.setVolume(v); return; }
      await callApi(`/me/player/volume?volume_percent=${Math.round(v * 100)}`, 'PUT');
    },
  };
}

export function useSpotifyPlayer(connection: SpotifyConnection | null | undefined) {
  const [isReady, setIsReady] = useState(false);
  const error = useSyncExternalStore(subscribePlayerError, getPlayerErrorSnapshot, () => null);

  useEffect(() => {
    if (!connection) return;
    // Skip Web Playback SDK on Electron — DRM/Widevine not available in packaged builds.
    // Falls back to REST API remote control.
    if (typeof window !== 'undefined' && window.desktop) return;
    let cancelled = false;

    const getAccessToken = async () => getValidAccessToken(connection);

    loadSpotifyPlaybackSDK()
      .then(() => initPlayer(getAccessToken))
      .then(() => {
        if (!cancelled) setIsReady(!!getDeviceId());
        const check = setInterval(() => {
          if (cancelled) { clearInterval(check); return; }
          if (getDeviceId()) { setIsReady(true); clearInterval(check); }
        }, 200);
        setTimeout(() => clearInterval(check), 5000);
      })
      .catch(err => console.warn('Spotify SDK init failed:', err));

    return () => { cancelled = true; };
  }, [connection?.id]);

  return { isReady, error, isPremium: getIsPremium() };
}

export function useSpotifySDKPlayback(): SpotifyPlaybackState | null {
  const state = useSyncExternalStore(subscribePlayerState, getPlayerStateSnapshot, () => null);
  if (!state) return null;
  return {
    track: state.track ? {
      name: state.track.name,
      artist: state.track.artist,
      albumArt: state.track.albumArt,
      durationMs: state.track.durationMs,
      progressMs: state.progressMs,
    } : null,
    isPlaying: state.isPlaying,
  };
}

export function useSpotifyProgress(playback: SpotifyPlaybackState | null) {
  const currentProgressMs = playback?.track?.progressMs ?? 0;
  const isPlaying = playback?.isPlaying ?? false;
  const durationMs = playback?.track?.durationMs ?? 0;

  const [interpolated, setInterpolated] = useState(0);
  const baseRef = useRef({ progressMs: 0, timestamp: 0 });

  useEffect(() => {
    baseRef.current = { progressMs: currentProgressMs, timestamp: Date.now() };

    if (!isPlaying || !durationMs) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - baseRef.current.timestamp;
      setInterpolated(Math.min(baseRef.current.progressMs + elapsed, durationMs));
    }, 200);

    return () => clearInterval(interval);
  }, [currentProgressMs, isPlaying, durationMs]);

  return {
    progressMs: playback?.track ? (isPlaying ? interpolated : currentProgressMs) : 0,
    durationMs,
  };
}
