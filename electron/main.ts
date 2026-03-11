/**
 * Electron Main Process
 *
 * Entry point for the WorkTracker desktop application.
 * Configures the main BrowserWindow with security best practices
 * and handles application lifecycle events.
 *
 * SECURITY:
 * - contextIsolation: true - Prevents renderer access to Node.js
 * - nodeIntegration: false - Disables Node.js in renderer
 * - Preload script exposes only safe APIs via contextBridge
 * - Content Security Policy restricts resource loading
 */

import {
  app,
  BrowserWindow,
  session,
  ipcMain,
  dialog,
  Notification,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  protocol,
  net,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import * as http from 'http';
import * as path from 'path';
// Register custom protocol as privileged BEFORE app is ready.
// This makes the 'app://' scheme a secure context, enabling EME/Widevine DRM.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false,
    },
  },
]);

// Local HTTP server port for receiving the OAuth callback in the system browser.
// Add http://127.0.0.1:54321/auth/callback to Supabase/Spotify redirect allow-list.
const OAUTH_CALLBACK_PORT = 54321;
let callbackServer: http.Server | null = null;

function startOAuthCallbackServer(): void {
  if (callbackServer) return;

  callbackServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${OAUTH_CALLBACK_PORT}`);

    if (url.pathname === '/auth/callback') {
      // Check if this is a Spotify PKCE callback (has code query param)
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (code) {
        // Spotify PKCE flow: forward code to renderer via IPC
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body style="background:#0F0F0F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Spotify connected!</h2><p>Returning to WorkTracker...</p></div>
<script>setTimeout(function(){window.close()},1000)</script>
</body></html>`);
        if (mainWindow) {
          mainWindow.webContents.send('spotify-callback', code, state ?? '');
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          app.focus({ steal: true });
          mainWindow.focus();
        }
        return;
      }

      // Supabase implicit flow: tokens are in the URL hash which browsers don't send
      // to the server. Serve a page whose JS reads the hash and POSTs it back.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body style="background:#0F0F0F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Sign-in complete!</h2><p>Returning to WorkTracker...</p></div>
<script>
var h=window.location.hash.substring(1);
if(h){fetch('/auth/exchange?'+h).then(function(){setTimeout(function(){window.location.href='worktracker://close'},400)})}
else{document.querySelector('p').textContent='Something went wrong — no tokens received.'}
</script></body></html>`);
    } else if (url.pathname === '/auth/exchange') {
      // Receive tokens forwarded by the callback page's JS
      res.writeHead(200);
      res.end('ok');
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      if (accessToken && refreshToken) {
        handleOAuthCallback(
          JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: parseInt(url.searchParams.get('expires_in') ?? '3600', 10),
            token_type: url.searchParams.get('token_type') ?? 'bearer',
          })
        );
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  callbackServer.listen(OAUTH_CALLBACK_PORT, '127.0.0.1');
}

// Development mode detection
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Web build URL configuration
const DEV_URL = 'http://localhost:19006';
const PROD_SERVER_PORT = 19007;
const PROD_URL = isDev ? DEV_URL : `http://localhost:${PROD_SERVER_PORT}/index.html`;

// In production, serve dist/ from a local HTTP server.
// EME/Widevine requires HTTP(S) origin — file:// and custom protocols don't work.
let prodServer: http.Server | null = null;
function startProdFileServer(): void {
  if (isDev || prodServer) return;
  const distDir = path.join(__dirname, '../dist');
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
  };
  prodServer = http.createServer((req, res) => {
    let pathname = new URL(req.url ?? '/', `http://localhost:${PROD_SERVER_PORT}`).pathname;
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(distDir, pathname);
    // Security: prevent path traversal
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fs = require('fs') as typeof import('fs');
    fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
      if (err) {
        // SPA fallback: serve index.html for missing routes
        if (err.code === 'ENOENT' && ext === '') {
          fs.readFile(
            path.join(distDir, 'index.html'),
            (_e: NodeJS.ErrnoException | null, html: Buffer) => {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(html);
            }
          );
          return;
        }
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
  prodServer.listen(PROD_SERVER_PORT, '127.0.0.1');
}

/**
 * Main application window reference
 * Stored globally to prevent garbage collection
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Floating timer widget window reference
 */
let floatingWindow: BrowserWindow | null = null;

/**
 * System tray reference
 * Stored globally to prevent garbage collection
 */
let tray: Tray | null = null;

/**
 * Content Security Policy for the application
 * Allows:
 * - self: Local resources
 * - Supabase endpoints: API and realtime connections
 * - Google OAuth: Authentication flow
 * - unsafe-inline for styles (required by React Native Web)
 */
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.scdn.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://apis.google.com https://api.github.com https://github.com https://accounts.spotify.com https://api.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co https://*.spotifycdn.com",
  "frame-src 'self' https://accounts.google.com https://sdk.scdn.co https://*.spotify.com",
  "media-src 'self' blob: https://*.spotify.com https://*.scdn.co https://*.spotifycdn.com",
  "worker-src 'self' blob:",
].join('; ');

/**
 * Create the main application window
 */
function createWindow(): void {
  // Set Content Security Policy before window creation
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_POLICY],
      },
    });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    backgroundColor: '#0F0F0F', // Match app dark theme background
    title: 'WorkTracker',
    show: false, // Don't show until ready to prevent flash
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      // Additional security settings
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Load the appropriate URL based on environment
  const loadUrl = isDev ? DEV_URL : PROD_URL;
  void mainWindow.loadURL(loadUrl);

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open DevTools in development, or via Cmd+Option+I in production
  if (isDev) {
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.meta && input.alt && input.key === 'i') {
        mainWindow?.webContents.openDevTools();
      }
    });
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize
  mainWindow.on('minimize', () => {
    // Could emit event to renderer if needed
  });

  // Handle window maximize/restore
  mainWindow.on('maximize', () => {
    // Could emit event to renderer if needed
  });

  mainWindow.on('unmaximize', () => {
    // Could emit event to renderer if needed
  });

  // Prevent navigation to external URLs in the main window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);

    // Allow file:// and app:// protocols
    if (parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'app:') {
      return;
    }

    if (parsedUrl.protocol === 'worktracker:') {
      event.preventDefault();
      if (parsedUrl.hostname !== 'close') {
        handleOAuthCallback(url);
      }
      return;
    }

    // Allow localhost in development
    if (isDev && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
      return;
    }

    // Block other navigations
    event.preventDefault();
    console.warn(`Blocked navigation to: ${url}`);
  });

  // Handle new window requests — always open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * Create the system tray with context menu
 */
function createTray(): void {
  // Create a simple 16x16 circle icon programmatically
  const iconDataURL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
    'QklEQVQ4T2NkoBAwUqifYdAY8B8bHxkbJYaQdAHIAGwYpwuIMgDZBcgYqwuINgCbIbhc' +
    'QLQBuAzB5gKiDcDnZwBergwRAYjf4QAAAABJRU5ErkJggg==';
  const icon = nativeImage.createFromDataURL(iconDataURL);

  tray = new Tray(icon);
  tray.setToolTip('WorkTracker');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide WorkTracker',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * Create or destroy the floating timer widget
 */
function toggleFloatingWidget(): void {
  if (floatingWindow) {
    floatingWindow.close();
    return;
  }

  floatingWindow = new BrowserWindow({
    width: 220,
    height: 80,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'floatingPreload.js'),
      sandbox: true,
    },
  });

  void floatingWindow.loadFile(path.join(__dirname, 'floatingWidget.html'));

  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.show();
  });

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

/**
 * Handle OAuth deep link: worktracker://auth/callback?code=...
 * Sends the full callback URL to the renderer via IPC so the Supabase SDK
 * can call exchangeCodeForSession() with the stored PKCE code_verifier.
 */
function handleOAuthCallback(url: string): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  app.focus({ steal: true });
  mainWindow.focus();
  mainWindow.webContents.send('oauth-callback', url);
}

// ============================================================================
// AUTO-UPDATER
// ============================================================================

function setupAutoUpdater(): void {
  // Allow updates for unsigned dev builds
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', info => {
    console.warn('[updater] Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', `Downloading update v${info.version}...`);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.warn('[updater] App is up to date');
  });

  autoUpdater.on('download-progress', progress => {
    console.warn(`[updater] Download: ${progress.percent.toFixed(0)}%`);
  });

  autoUpdater.on('update-downloaded', info => {
    console.warn('[updater] Update downloaded:', info.version);
    const { shell } = require('electron') as typeof import('electron');
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available.`,
        detail: 'Would you like to download and install it?',
        buttons: ['Download Update', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          // Open the releases page so the user can grab the latest DMG
          void shell.openExternal(
            `https://github.com/PolarBaeJr/time-tracker/releases/tag/v${info.version}`
          );
        }
      });
  });

  autoUpdater.on('error', error => {
    console.error('[updater] Error:', error.message);
  });

  // Check for updates (silently — don't block startup)
  void autoUpdater.checkForUpdates().catch(err => {
    console.warn('[updater] Failed to check for updates:', err.message);
  });
}

// Register worktracker:// as a protocol client for OAuth callbacks
app.setAsDefaultProtocolClient('worktracker');

/**
 * Enforce single instance of the application
 * If another instance is started, focus the existing window
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // On Windows/Linux the deep link URL comes via second-instance argv
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLink = argv.find(arg => arg.startsWith('worktracker://'));
    if (deepLink) handleOAuthCallback(deepLink);
  });

  // On macOS the deep link comes via open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const parsed = new URL(url);
    if (parsed.hostname !== 'close') {
      handleOAuthCallback(url);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      app.focus({ steal: true });
      mainWindow.focus();
    }
  });

  // App is ready to create windows
  app.whenReady().then(() => {
    // Register app:// protocol to serve dist/ files from a secure context (needed for EME/Widevine)
    const distDir = path.join(__dirname, '../dist');
    protocol.handle('app', request => {
      const url = new URL(request.url);
      let filePath = path.join(distDir, decodeURIComponent(url.pathname));
      // Default to index.html for directory requests
      if (filePath.endsWith('/') || !path.extname(filePath)) {
        filePath = path.join(distDir, 'index.html');
      }
      // Security: prevent path traversal - ensure resolved path stays within distDir
      const resolvedPath = path.resolve(filePath);
      const resolvedDistDir = path.resolve(distDir);
      if (
        !resolvedPath.startsWith(resolvedDistDir + path.sep) &&
        resolvedPath !== resolvedDistDir
      ) {
        return new Response('Forbidden', { status: 403 });
      }
      return net.fetch(`file://${resolvedPath}`);
    });

    startProdFileServer();
    createWindow();
    createTray();

    // Register global shortcut for toggling timer
    globalShortcut.register('CommandOrControl+Shift+T', () => {
      if (mainWindow) {
        mainWindow.webContents.send('global-shortcut-toggle');
      }
    });

    // Check for updates in production builds
    if (!isDev) {
      setupAutoUpdater();
    }

    // macOS: Re-create window when dock icon is clicked
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Expose OAuth redirect URL to renderer via IPC
  ipcMain.handle(
    'get-oauth-redirect-url',
    () => `http://127.0.0.1:${OAUTH_CALLBACK_PORT}/auth/callback`
  );

  // Check for updates manually from the renderer
  ipcMain.handle('check-for-updates', () => {
    if (isDev) return { updateAvailable: false };
    return autoUpdater.checkForUpdates().catch(() => ({ updateAvailable: false }));
  });

  // Get current app version
  ipcMain.handle('get-app-version', () => app.getVersion());

  // Show a desktop notification
  ipcMain.on('show-notification', (_event, title: string, body: string) => {
    const notification = new Notification({ title, body });
    notification.show();
  });

  // Update tray tooltip with timer state and forward to floating widget
  ipcMain.on(
    'update-tray',
    (_event, state: { isRunning: boolean; elapsed: string; phase?: string }) => {
      if (tray) {
        const parts = ['WorkTracker'];
        if (state.isRunning) {
          parts.push(`${state.elapsed}`);
          if (state.phase) {
            parts.push(`(${state.phase})`);
          }
        }
        tray.setToolTip(parts.join(' - '));
      }

      // Forward timer state to floating widget
      if (floatingWindow && !floatingWindow.isDestroyed()) {
        floatingWindow.webContents.send('floating-timer-update', state);
      }
    }
  );

  // Toggle floating timer widget
  ipcMain.on('toggle-floating-widget', () => {
    toggleFloatingWidget();
  });

  // Close floating timer widget (from widget's close button)
  ipcMain.on('close-floating-widget', () => {
    if (floatingWindow) {
      floatingWindow.close();
    }
  });

  // Open a URL in the system browser from the renderer
  // Security: only allow specific protocols and trusted domains
  const ALLOWED_EXTERNAL_PROTOCOLS = ['https:', 'http:'];
  const ALLOWED_EXTERNAL_DOMAINS = [
    'accounts.google.com',
    'accounts.spotify.com',
    'github.com',
    'supabase.co',
    'supabase.in',
  ];
  ipcMain.handle('open-external-url', (_event, url: string) => {
    try {
      const parsedUrl = new URL(url);
      // Only allow http/https protocols
      if (!ALLOWED_EXTERNAL_PROTOCOLS.includes(parsedUrl.protocol)) {
        console.warn(`Blocked external URL with disallowed protocol: ${url}`);
        return Promise.reject(new Error('Disallowed protocol'));
      }
      // Check if domain is in allowlist or is a subdomain of an allowed domain
      const hostname = parsedUrl.hostname.toLowerCase();
      const isAllowed = ALLOWED_EXTERNAL_DOMAINS.some(
        domain => hostname === domain || hostname.endsWith('.' + domain)
      );
      if (!isAllowed) {
        console.warn(`Blocked external URL with disallowed domain: ${url}`);
        return Promise.reject(new Error('Disallowed domain'));
      }
      const { shell } = require('electron');
      startOAuthCallbackServer();
      return shell.openExternal(url);
    } catch (err) {
      console.warn(`Blocked malformed external URL: ${url}`);
      return Promise.reject(new Error('Invalid URL'));
    }
  });
}

// Unregister all global shortcuts before quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new webview/webcontents creation
app.on('web-contents-created', (_event, contents) => {
  // Disable webview tag
  contents.on('will-attach-webview', event => {
    event.preventDefault();
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:', reason);
});
