/**
 * Desktop notification helper
 *
 * Uses Electron IPC when available, falls back to Web Notification API,
 * and no-ops on platforms without notification support.
 */

export function sendNotification(title: string, body: string): void {
  if (window.desktop?.showNotification) {
    window.desktop.showNotification(title, body);
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }
  // No-op on platforms without notification support
}
