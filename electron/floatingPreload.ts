import { contextBridge, ipcRenderer } from 'electron';

interface TimerState {
  isRunning: boolean;
  elapsed: string;
  phase?: string;
}

const electronAPI = {
  onTimerUpdate: (callback: (state: TimerState) => void) => {
    ipcRenderer.on('floating-timer-update', (_event, state: TimerState) => callback(state));
  },
  closeWidget: () => {
    ipcRenderer.send('close-floating-widget');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
