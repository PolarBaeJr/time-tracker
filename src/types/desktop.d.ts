interface DesktopAPI {
  versions: {
    node: string;
    chrome: string;
    electron: string;
    v8: string;
  };
  platform: {
    os: string;
    arch: string;
    isElectron: true;
  };
  getOAuthRedirectUrl: () => Promise<string>;
  openExternalUrl: (url: string) => Promise<void>;
  onOAuthCallback: (callback: (url: string) => void) => void;
  onSpotifyCallback: (callback: (code: string, state: string) => void) => void;
  checkForUpdates: () => Promise<unknown>;
  getAppVersion: () => Promise<string>;
  onUpdateStatus: (callback: (message: string) => void) => void;
  showNotification: (title: string, body: string) => void;
  updateTray: (state: { isRunning: boolean; elapsed: string; phase?: string }) => void;
  toggleFloatingWidget: () => void;
  onGlobalShortcut: (callback: () => void) => void;
}

declare namespace Spotify {
  interface PlayerOptions {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  interface WebPlaybackTrack {
    uri: string;
    id: string;
    type: string;
    media_type: string;
    name: string;
    is_playable: boolean;
    album: {
      uri: string;
      name: string;
      images: { url: string }[];
    };
    artists: { uri: string; name: string }[];
  }

  interface WebPlaybackState {
    context: { uri: string | null; metadata: Record<string, unknown> | null };
    disallows: Record<string, boolean>;
    paused: boolean;
    position: number;
    duration: number;
    repeat_mode: number;
    shuffle: boolean;
    track_window: {
      current_track: WebPlaybackTrack;
      previous_tracks: WebPlaybackTrack[];
      next_tracks: WebPlaybackTrack[];
    };
  }

  interface WebPlaybackError {
    message: string;
  }

  class Player {
    constructor(options: PlayerOptions);
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): void;
    addListener(event: 'player_state_changed', cb: (state: WebPlaybackState | null) => void): void;
    addListener(
      event: 'authentication_error' | 'account_error' | 'initialization_error' | 'playback_error',
      cb: (error: WebPlaybackError) => void
    ): void;
    removeListener(event: string, cb?: (...args: unknown[]) => void): void;
    getCurrentState(): Promise<WebPlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  }
}

declare global {
  interface Window {
    desktop?: DesktopAPI;
    Spotify?: typeof Spotify;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export {};
