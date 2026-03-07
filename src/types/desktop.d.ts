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
  }
}

export {};
