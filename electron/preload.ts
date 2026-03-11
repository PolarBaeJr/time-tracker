/**
 * Electron Preload Script
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 * This script runs in a sandboxed context with access to Node.js APIs,
 * but the renderer process cannot access Node.js directly.
 *
 * SECURITY:
 * - Only expose necessary APIs
 * - Never expose full Node.js modules
 * - Validate all inputs from renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Platform information exposed to renderer
 */
interface PlatformInfo {
  /** Operating system platform */
  os: NodeJS.Platform;
  /** CPU architecture */
  arch: string;
  /** Whether running in Electron */
  isElectron: true;
}

/**
 * Version information for Electron and dependencies
 */
interface VersionInfo {
  /** Node.js version */
  node: string;
  /** Chrome/Chromium version */
  chrome: string;
  /** Electron version */
  electron: string;
  /** V8 JavaScript engine version */
  v8: string;
}

/**
 * Desktop API exposed to the renderer process
 */
interface DesktopAPI {
  /** Version information */
  versions: VersionInfo;
  /** Platform information */
  platform: PlatformInfo;
  /** Get the OAuth redirect URL for this platform */
  getOAuthRedirectUrl: () => Promise<string>;
  /** Open a URL in the system browser */
  openExternalUrl: (url: string) => Promise<void>;
  /** Listen for OAuth callback URL from main process (full worktracker:// URL) */
  onOAuthCallback: (callback: (url: string) => void) => void;
  /** Listen for Spotify PKCE callback (code + state from redirect) */
  onSpotifyCallback: (callback: (code: string, state: string) => void) => void;
  /** Check for app updates */
  checkForUpdates: () => Promise<unknown>;
  /** Get current app version */
  getAppVersion: () => Promise<string>;
  /** Listen for update status messages */
  onUpdateStatus: (callback: (message: string) => void) => void;
  /** Show a desktop notification */
  showNotification: (title: string, body: string) => void;
  /** Update tray timer state */
  updateTray: (state: { isRunning: boolean; elapsed: string; phase?: string }) => void;
  /** Toggle the floating timer widget */
  toggleFloatingWidget: () => void;
  /** Listen for global shortcut toggle */
  onGlobalShortcut: (callback: () => void) => void;
}

/**
 * Get version information from process.versions
 */
function getVersions(): VersionInfo {
  return {
    node: process.versions.node ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    electron: process.versions.electron ?? 'unknown',
    v8: process.versions.v8 ?? 'unknown',
  };
}

/**
 * Get platform information
 */
function getPlatform(): PlatformInfo {
  return {
    os: process.platform,
    arch: process.arch,
    isElectron: true,
  };
}

/**
 * Desktop API object exposed via contextBridge
 */
const desktopAPI: DesktopAPI = {
  versions: getVersions(),
  platform: getPlatform(),
  getOAuthRedirectUrl: () => ipcRenderer.invoke('get-oauth-redirect-url') as Promise<string>,
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url) as Promise<void>,
  onOAuthCallback: (callback: (url: string) => void) => {
    ipcRenderer.on('oauth-callback', (_event, url: string) => callback(url));
  },
  onSpotifyCallback: (callback: (code: string, state: string) => void) => {
    ipcRenderer.on('spotify-callback', (_event, code: string, state: string) => callback(code, state));
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates') as Promise<unknown>,
  getAppVersion: () => ipcRenderer.invoke('get-app-version') as Promise<string>,
  onUpdateStatus: (callback: (message: string) => void) => {
    ipcRenderer.on('update-status', (_event, message: string) => callback(message));
  },
  showNotification: (title: string, body: string) => {
    ipcRenderer.send('show-notification', title, body);
  },
  updateTray: (state: { isRunning: boolean; elapsed: string; phase?: string }) => {
    ipcRenderer.send('update-tray', state);
  },
  toggleFloatingWidget: () => {
    ipcRenderer.send('toggle-floating-widget');
  },
  onGlobalShortcut: (callback: () => void) => {
    ipcRenderer.on('global-shortcut-toggle', () => callback());
  },
};

// Expose the API to the renderer process
// The renderer can access these via window.desktop
contextBridge.exposeInMainWorld('desktop', desktopAPI);

// Type declaration for TypeScript support in renderer
declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}

export type { DesktopAPI, VersionInfo, PlatformInfo };
