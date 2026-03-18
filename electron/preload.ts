import { contextBridge, ipcRenderer } from 'electron';

type RendererListener = (...args: unknown[]) => void;
type RendererHandler = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void;

const listenerMap = new Map<string, WeakMap<RendererListener, RendererHandler>>();

function getChannelListeners(channel: string): WeakMap<RendererListener, RendererHandler> {
  let listeners = listenerMap.get(channel);
  if (!listeners) {
    listeners = new WeakMap<RendererListener, RendererHandler>();
    listenerMap.set(channel, listeners);
  }

  return listeners;
}

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    sendSync: (channel: string, ...args: unknown[]) => ipcRenderer.sendSync(channel, ...args),
    on: (channel: string, listener: RendererListener) => {
      const wrappedListener: RendererHandler = (_event, ...args) => listener(...args);
      getChannelListeners(channel).set(listener, wrappedListener);
      ipcRenderer.on(channel, wrappedListener);
    },
    removeListener: (channel: string, listener: RendererListener) => {
      const channelListeners = getChannelListeners(channel);
      const wrappedListener = channelListeners.get(listener);
      if (!wrappedListener) {
        return;
      }

      ipcRenderer.removeListener(channel, wrappedListener);
      channelListeners.delete(listener);

      // Clean up empty maps to reduce memory footprint
      if (channelListeners.size === 0) {
        listenerMap.delete(channel);
      }
    }
  }
});
