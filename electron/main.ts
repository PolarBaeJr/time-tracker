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

import { app, BrowserWindow, session, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as http from 'http';
import * as path from 'path';

// Local HTTP server port for receiving the OAuth callback in the system browser.
// Add http://localhost:54321/auth/callback to Supabase redirect allow-list.
const OAUTH_CALLBACK_PORT = 54321;
let callbackServer: http.Server | null = null;

function startOAuthCallbackServer(): void {
  if (callbackServer) return;

  callbackServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${OAUTH_CALLBACK_PORT}`);

    if (url.pathname === '/auth/callback') {
      // Implicit flow: tokens are in the URL hash which browsers don't send
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
const PROD_URL = `file://${path.join(__dirname, '../dist/index.html')}`;

/**
 * Main application window reference
 * Stored globally to prevent garbage collection
 */
let mainWindow: BrowserWindow | null = null;

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
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://apis.google.com https://api.github.com https://github.com",
  "frame-src 'self' https://accounts.google.com",
  "worker-src 'self' blob:",
].join('; ');

/**
 * Create the main application window
 */
function createWindow(): void {
  const distDir = path.join(__dirname, '../dist');

  // Expo web exports use absolute paths (/_expo/*, /favicon.ico) which
  // resolve to file:/// root and 404. Intercept and redirect to dist/.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['file://*/*'] },
    (details, callback) => {
      const url = new URL(details.url);
      if (
        url.pathname.startsWith('/_expo/') ||
        url.pathname.startsWith('/assets/') ||
        url.pathname === '/favicon.ico'
      ) {
        callback({ redirectURL: `file://${path.join(distDir, url.pathname)}` });
      } else {
        callback({});
      }
    }
  );

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

    // Allow file:// protocol
    if (parsedUrl.protocol === 'file:') {
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
    console.log('[updater] Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', `Downloading update v${info.version}...`);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App is up to date');
  });

  autoUpdater.on('download-progress', progress => {
    console.log(`[updater] Download: ${progress.percent.toFixed(0)}%`);
  });

  autoUpdater.on('update-downloaded', info => {
    console.log('[updater] Update downloaded:', info.version);
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'Restart now to apply the update?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          // Use setImmediate to avoid race conditions with the dialog
          setImmediate(() => {
            // Prevent the window close from being intercepted
            app.removeAllListeners('window-all-closed');
            if (mainWindow) {
              mainWindow.removeAllListeners('close');
              mainWindow.close();
            }
            autoUpdater.quitAndInstall(false, true);
          });
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
    createWindow();

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
    () => `http://localhost:${OAUTH_CALLBACK_PORT}/auth/callback`
  );

  // Check for updates manually from the renderer
  ipcMain.handle('check-for-updates', () => {
    if (isDev) return { updateAvailable: false };
    return autoUpdater.checkForUpdates().catch(() => ({ updateAvailable: false }));
  });

  // Get current app version
  ipcMain.handle('get-app-version', () => app.getVersion());

  // Open a URL in the system browser from the renderer
  ipcMain.handle('open-external-url', (_event, url: string) => {
    const { shell } = require('electron');
    startOAuthCallbackServer();
    return shell.openExternal(url);
  });
}

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
