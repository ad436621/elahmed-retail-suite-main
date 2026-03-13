import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    sendSync: (channel: string, ...args: any[]) => ipcRenderer.sendSync(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => listener(...args));
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      // @ts-ignore - Need exact function ref mapping for strict removals if needed later
      ipcRenderer.removeListener(channel, listener);
    }
  }
});
