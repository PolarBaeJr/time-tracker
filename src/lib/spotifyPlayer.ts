import { loadSpotifyPlaybackSDK, spotifyFetch } from './spotify';

// Module-level state
let player: Spotify.Player | null = null;
let deviceId: string | null = null;
let isPremium = true; // assume true until proven otherwise
let currentState: PlayerState | null = null;
let playerError: PlayerError | null = null;

export interface PlayerState {
  track: { name: string; artist: string; albumArt: string | null; durationMs: number } | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

export interface PlayerError {
  type: 'premium_required' | 'auth_error' | 'init_error';
  message: string;
}

// Listeners (useSyncExternalStore pattern)
const stateListeners = new Set<() => void>();
const errorListeners = new Set<() => void>();

function notifyState() {
  stateListeners.forEach(l => l());
}
function notifyError() {
  errorListeners.forEach(l => l());
}

export async function initPlayer(getAccessToken: () => Promise<string>): Promise<void> {
  if (player) return;

  await loadSpotifyPlaybackSDK();

  const token = await getAccessToken();

  player = new Spotify.Player({
    name: 'WorkTracker',
    getOAuthToken: async cb => {
      cb(await getAccessToken());
    },
    volume: 0.5,
  });

  player.addListener('ready', ({ device_id }: { device_id: string }) => {
    deviceId = device_id;
    // Transfer playback to this device
    spotifyFetch(token, '/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [device_id], play: false }),
    }).catch(() => {}); // ignore if no active session
  });

  player.addListener('player_state_changed', (state: Spotify.WebPlaybackState | null) => {
    if (!state) {
      currentState = null;
      notifyState();
      return;
    }
    const track = state.track_window.current_track;
    currentState = {
      track: track
        ? {
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            albumArt: track.album.images[0]?.url ?? null,
            durationMs: state.duration,
          }
        : null,
      isPlaying: !state.paused,
      progressMs: state.position,
      durationMs: state.duration,
    };
    notifyState();
  });

  player.addListener('account_error', ({ message }: Spotify.WebPlaybackError) => {
    isPremium = false;
    playerError = { type: 'premium_required', message };
    notifyError();
    player?.disconnect();
    player = null;
  });

  player.addListener('authentication_error', ({ message }: Spotify.WebPlaybackError) => {
    playerError = { type: 'auth_error', message };
    notifyError();
  });

  player.addListener('initialization_error', ({ message }: Spotify.WebPlaybackError) => {
    playerError = { type: 'init_error', message };
    notifyError();
  });

  await player.connect();
}

export function destroyPlayer() {
  player?.disconnect();
  player = null;
  deviceId = null;
  currentState = null;
  playerError = null;
  notifyState();
}

export function getPlayer() {
  return player;
}
export function getDeviceId() {
  return deviceId;
}
export function getIsPremium() {
  return isPremium;
}

// useSyncExternalStore-compatible
export function subscribePlayerState(cb: () => void) {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}
export function getPlayerStateSnapshot() {
  return currentState;
}

export function subscribePlayerError(cb: () => void) {
  errorListeners.add(cb);
  return () => {
    errorListeners.delete(cb);
  };
}
export function getPlayerErrorSnapshot() {
  return playerError;
}
