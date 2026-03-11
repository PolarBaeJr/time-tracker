/**
 * Spotify Web Playback SDK singleton
 *
 * Manages a single Spotify.Player instance and exposes
 * useSyncExternalStore-compatible subscriptions for player state and errors.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PlayerState {
  track: {
    name: string;
    artist: string;
    albumArt: string | null;
    durationMs: number;
  } | null;
  isPlaying: boolean;
  progressMs: number;
}

export interface PlayerError {
  type: 'authentication_error' | 'initialization_error' | 'account_error';
  message: string;
}

// ============================================================================
// SINGLETON STATE (survives duplicate module instances via window.__sps)
// ============================================================================

interface SpotifyPlayerSingleton {
  player: Spotify.Player | null;
  deviceId: string | null;
  isPremium: boolean;
  currentState: PlayerState | null;
  currentError: PlayerError | null;
  stateListeners: Set<() => void>;
  errorListeners: Set<() => void>;
}

declare global {
  interface Window {
    __sps?: SpotifyPlayerSingleton;
  }
}

function getSingleton(): SpotifyPlayerSingleton {
  if (!window.__sps) {
    window.__sps = {
      player: null,
      deviceId: null,
      isPremium: true,
      currentState: null,
      currentError: null,
      stateListeners: new Set(),
      errorListeners: new Set(),
    };
  }
  return window.__sps;
}

// ============================================================================
// NOTIFY HELPERS
// ============================================================================

function notifyState() {
  const s = getSingleton();
  s.stateListeners.forEach(l => l());
}

function notifyError() {
  const s = getSingleton();
  s.errorListeners.forEach(l => l());
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function getPlayer(): Spotify.Player | null {
  return getSingleton().player;
}

export function getDeviceId(): string | null {
  return getSingleton().deviceId;
}

export function getIsPremium(): boolean {
  return getSingleton().isPremium;
}

// useSyncExternalStore-compatible subscriptions

export function subscribePlayerState(cb: () => void): () => void {
  const s = getSingleton();
  s.stateListeners.add(cb);
  return () => { s.stateListeners.delete(cb); };
}

export function getPlayerStateSnapshot(): PlayerState | null {
  return getSingleton().currentState;
}

export function subscribePlayerError(cb: () => void): () => void {
  const s = getSingleton();
  s.errorListeners.add(cb);
  return () => { s.errorListeners.delete(cb); };
}

export function getPlayerErrorSnapshot(): PlayerError | null {
  return getSingleton().currentError;
}

// ============================================================================
// INIT / DESTROY
// ============================================================================

export async function initPlayer(
  getAccessToken: () => Promise<string>
): Promise<void> {
  const s = getSingleton();

  // Already initialised
  if (s.player && s.deviceId) return;

  // Already have a player but no device — destroy and retry
  if (s.player) {
    s.player.disconnect();
    s.player = null;
    s.deviceId = null;
  }

  const player = new window.Spotify.Player({
    name: 'WorkTracker',
    getOAuthToken: async (cb: (token: string) => void) => {
      try {
        const token = await getAccessToken();
        cb(token);
      } catch (err) {
        console.log('[SpotifyPlayer] getOAuthToken failed:', err);
      }
    },
    volume: 0.5,
  });

  // Ready
  player.addListener('ready', ({ device_id }: { device_id: string }) => {
    console.log('[SpotifyPlayer] Ready, device_id:', device_id);
    s.deviceId = device_id;
    s.isPremium = true;
    s.currentError = null;
    notifyError();
  });

  // Not ready
  player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
    console.log('[SpotifyPlayer] Not ready, device_id:', device_id);
  });

  // Playback state changed
  player.addListener('player_state_changed', (state: Spotify.WebPlaybackState | null) => {
    if (!state) {
      s.currentState = null;
      notifyState();
      return;
    }
    const track = state.track_window?.current_track;
    s.currentState = {
      track: track
        ? {
            name: track.name,
            artist: track.artists?.map(a => a.name).join(', ') ?? 'Unknown',
            albumArt: track.album?.images?.[0]?.url ?? null,
            durationMs: state.duration,
          }
        : null,
      isPlaying: !state.paused,
      progressMs: state.position,
    };
    notifyState();
  });

  // Account error (free tier)
  player.addListener('account_error', ({ message }: Spotify.WebPlaybackError) => {
    console.log('[SpotifyPlayer] Account error:', message);
    s.isPremium = false;
    player.disconnect();
    s.currentError = { type: 'account_error', message };
    notifyError();
  });

  // Auth error
  player.addListener('authentication_error', ({ message }: Spotify.WebPlaybackError) => {
    console.log('[SpotifyPlayer] Authentication error:', message);
    s.currentError = { type: 'authentication_error', message };
    notifyError();
  });

  // Init error
  player.addListener('initialization_error', ({ message }: Spotify.WebPlaybackError) => {
    console.log('[SpotifyPlayer] Initialization error:', message);
    s.currentError = { type: 'initialization_error', message };
    notifyError();
  });

  s.player = player;

  const connected = await player.connect();
  console.log('[SpotifyPlayer] connect() returned:', connected);

  if (!connected && !s.deviceId) {
    player.disconnect();
    s.player = null;
    s.currentError = {
      type: 'initialization_error',
      message: 'Failed to connect to Spotify',
    };
    notifyError();
  }
}

export function destroyPlayer(): void {
  const s = getSingleton();
  if (s.player) {
    s.player.disconnect();
    s.player = null;
  }
  s.deviceId = null;
  s.currentState = null;
  s.currentError = null;
  notifyState();
  notifyError();
}
