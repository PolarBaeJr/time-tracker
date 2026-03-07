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
  checkForUpdates: () => Promise<unknown>;
  getAppVersion: () => Promise<string>;
  onUpdateStatus: (callback: (message: string) => void) => void;
  showNotification: (title: string, body: string) => void;
  updateTray: (state: { isRunning: boolean; elapsed: string; phase?: string }) => void;
  toggleFloatingWidget: () => void;
  onGlobalShortcut: (callback: () => void) => void;
}

declare global {
  interface Window {
    desktop?: DesktopAPI;
    Spotify?: typeof Spotify;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }

  namespace Spotify {
    interface PlayerOptions {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }

    interface WebPlaybackTrack {
      uri: string;
      id: string;
      name: string;
      artists: { name: string; uri: string }[];
      album: { name: string; images: { url: string }[] };
      duration_ms: number;
    }

    interface WebPlaybackState {
      paused: boolean;
      position: number;
      duration: number;
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
      togglePlay(): Promise<void>;
      previousTrack(): Promise<void>;
      nextTrack(): Promise<void>;
      seek(positionMs: number): Promise<void>;
      setVolume(volume: number): Promise<void>;
      getCurrentState(): Promise<WebPlaybackState | null>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addListener(event: string, callback: (...args: any[]) => void): boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      removeListener(event: string, callback?: (...args: any[]) => void): boolean;
    }
  }
}

export {};
