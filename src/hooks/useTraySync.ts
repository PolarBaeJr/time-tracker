/**
 * Tray sync hook
 *
 * Subscribes to the timer store and sends tray updates to the Electron
 * main process every second when a timer is running.
 */

import { useEffect } from 'react';

import { useTimerStore } from '@/stores';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useTraySync(): void {
  const isRunning = useTimerStore(state => state.isRunning);
  const localElapsed = useTimerStore(state => state.localElapsed);
  const activeTimer = useTimerStore(state => state.activeTimer);

  useEffect(() => {
    if (!window.desktop?.updateTray) return;

    const phase = activeTimer?.pomodoro_phase ?? undefined;

    window.desktop.updateTray({
      isRunning,
      elapsed: isRunning ? formatElapsed(localElapsed) : '00:00:00',
      phase,
    });
  }, [isRunning, localElapsed, activeTimer?.pomodoro_phase]);
}
