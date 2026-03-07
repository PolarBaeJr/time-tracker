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
